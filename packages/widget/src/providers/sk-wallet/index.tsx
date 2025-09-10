import type { Account } from "@ledgerhq/wallet-api-client";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { Address, Hash } from "viem";
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSignMessage,
} from "wagmi";
import { withRequestErrorRetry } from "../../common/utils";
import { config } from "../../config";
import {
  isBittensorChain,
  isEvmChain,
  isSolanaChain,
  isTonChain,
  isTronChain,
} from "../../domain/types/chains";
import {
  bittensorPayloadCodec,
  decodeAndPrepareEvmTransaction,
  unsignedEVMTransactionCodec,
  unsignedSolanaTransactionCodec,
  unsignedTonTransactionCodec,
  unsignedTronTransactionCodec,
} from "../../domain/types/transaction";
import type { SKWallet } from "../../domain/types/wallet";
import type {
  BittensorTx,
  SKTx,
  TronTx,
} from "../../domain/types/wallets/generic-wallet";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { useCheckIsUnmounted } from "../../hooks/use-check-is-unmounted";
import { useIsomorphicEffect } from "../../hooks/use-isomorphic-effect";
import { isLedgerDappBrowserProvider } from "../../utils";
import { isCosmosConnector } from "../cosmos/cosmos-connector-meta";
import { isExternalProviderConnector } from "../external-provider";
import { isLedgerLiveConnector } from "../ledger/ledger-live-connector-meta";
import { isSolanaConnector } from "../misc/solana-connector-meta";
import { isTronConnector } from "../misc/tron-connector-meta";
import { isSafeConnector } from "../safe/safe-connector-meta";
import { useWagmiConfig } from "../wagmi";
import {
  SafeFailedError,
  SendTransactionError,
  TransactionDecodeError,
} from "./errors";
import { useAdditionalAddresses } from "./use-additional-addresses";
import { useConnectorChains } from "./use-connector-chains";
import { useCosmosCW } from "./use-cosmos-cw";
import { useInit } from "./use-init";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { useLedgerCurrentAccountId } from "./use-ledger-current-account-id";
import { useSyncExternalProvider } from "./use-sync-external-provider";
import { wagmiNetworkToSKNetwork } from "./utils";

const SKWalletContext = createContext<SKWallet | undefined>(undefined);

export const SKWalletProvider = ({ children }: PropsWithChildren) => {
  const {
    isReconnecting,
    isConnected: _isConnected,
    isConnecting: _isConnecting,
    address: _address,
    connector: _connector,
    chain,
  } = useAccount();

  const address = (config.env.forceAddress as Address) || _address;

  const checkIsUnmounted = useCheckIsUnmounted();

  const { isLoading } = useInit();

  const connector =
    _connector?.connect && _connector.emitter ? _connector : undefined;

  const { disconnectAsync: disconnect } = useDisconnect();

  const { sendTransactionAsync } = useSendTransaction();
  const { signMessageAsync } = useSignMessage();

  const ledgerAccounts = useLedgerAccounts(connector);
  const ledgerCurrentAccountId = useLedgerCurrentAccountId(connector);
  const cosmosCW = useCosmosCW(connector);

  const wagmiConfig = useWagmiConfig();

  const connectorChains = useConnectorChains({
    wagmiConfig: wagmiConfig.data,
    connector,
  });

  const network = useMemo(
    () =>
      Maybe.fromRecord({
        chain: Maybe.fromNullable(chain),
        wagmiConfig: Maybe.fromNullable(wagmiConfig.data),
      })
        .map((val) =>
          wagmiNetworkToSKNetwork({
            chain: val.chain,
            evmChainsMap: val.wagmiConfig.evmConfig.evmChainsMap,
            cosmosChainsMap: val.wagmiConfig.cosmosConfig.cosmosChainsMap,
            miscChainsMap: val.wagmiConfig.miscConfig.miscChainsMap,
            substrateChainsMap:
              val.wagmiConfig.substrateConfig.substrateChainsMap,
          })
        )
        .extractNullable(),
    [chain, wagmiConfig.data]
  );

  const isConnected = _isConnected && !!address && !!connector && !!network;

  const additionalAddresses = useAdditionalAddresses({
    address,
    connector,
    isConnected,
  });

  const isConnecting =
    isLoading ||
    _isConnecting ||
    isReconnecting ||
    wagmiConfig.isLoading ||
    additionalAddresses.isLoading;

  const trackEvent = useTrackEvent();

  useEffect(() => {
    if (!isConnected) return;

    trackEvent("connectedWallet", { address, network });
  }, [address, isConnected, network, trackEvent]);

  useSyncExternalProvider({
    address,
    chain,
    isConnected,
    isConnecting,
  });

  /**
   * Network missmatch, disconnect
   */
  useIsomorphicEffect(() => {
    if (!isConnecting && _isConnected && !isConnected) {
      disconnect();
    }
  }, [_isConnected, disconnect, isConnected]);

  const connectorDetails = useMemo(
    () =>
      EitherAsync.liftEither(
        !isConnected || !network || !connector || !address
          ? Left(new Error("No wallet connected"))
          : Right({ conn: connector, network, address })
      ),
    [connector, isConnected, network, address]
  );

  const signTransaction = useCallback<SKWallet["signTransaction"]>(
    ({ tx, ledgerHwAppId, txMeta, network }) =>
      connectorDetails
        .mapLeft(() => new SendTransactionError())
        .chain<
          TransactionDecodeError | SendTransactionError,
          { signedTx: string; broadcasted: boolean }
        >(({ conn, address }) => {
          /**
           * Ledger Live connector
           */
          if (isLedgerLiveConnector(conn)) {
            return EitherAsync.liftEither(
              Maybe.fromNullable(ledgerCurrentAccountId).toEither(
                new SendTransactionError()
              )
            )
              .chain((val) =>
                EitherAsync.liftEither(
                  Either.encase(() => JSON.parse(tx))

                    .chain((parsedTx) =>
                      Either.encase(() => conn.deserializeTransaction(parsedTx))
                    )
                    .mapLeft(() => new TransactionDecodeError())
                ).map((deserializedTransaction) => ({
                  accountId: val,
                  deserializedTransaction,
                }))
              )
              .chain(({ accountId, deserializedTransaction }) =>
                EitherAsync(() =>
                  conn.walletApiClient.transaction.signAndBroadcast(
                    accountId,
                    deserializedTransaction,
                    Maybe.fromNullable(ledgerHwAppId)
                      .map((v) => ({ hwAppId: v }))
                      .extract()
                  )
                ).mapLeft((e) => {
                  console.log(e);
                  return new SendTransactionError();
                })
              )
              .map((val) => ({ signedTx: val, broadcasted: true }));
          }

          /**
           * Cosmos connector
           */
          if (isCosmosConnector(conn)) {
            return EitherAsync.liftEither(
              Maybe.fromNullable(cosmosCW).toEither(
                new Error("cosmosCW missing")
              )
            )
              .chain((cw) =>
                // We need to sign + broadcast as `walletconnect` cosmos client does not support `sendTx`
                conn
                  .signTransaction({ cw, tx })
                  .map((val) => ({ signedTx: val, broadcasted: false }))
              )
              .mapLeft(() => new SendTransactionError());
          }

          /**
           * Tron connector
           */
          if (isTronConnector(conn)) {
            return EitherAsync.liftEither(
              Either.encase(() => JSON.parse(tx))
                .chain((val) => unsignedTronTransactionCodec.decode(val))
                .mapLeft((e) => {
                  console.log(e);
                  return new TransactionDecodeError();
                })
            )
              .chain((val) =>
                EitherAsync(() => conn.signTransaction(val)).mapLeft((e) => {
                  console.log(e);
                  return new SendTransactionError();
                })
              )
              .map((val) => ({
                signedTx: JSON.stringify(val),
                broadcasted: false,
              }));
          }

          /**
           * External provider connector
           */
          if (isExternalProviderConnector(conn)) {
            return EitherAsync.liftEither(
              Right(null)
                .chain<string, SKTx>(() => {
                  if (isEvmChain(network)) {
                    return Either.encase(() => JSON.parse(tx))
                      .mapLeft(() => "Failed to parse tx")
                      .chain((val) =>
                        decodeAndPrepareEvmTransaction({ address, input: val })
                      )
                      .map((v) => ({ type: "evm", tx: v }));
                  }

                  if (isSolanaChain(network)) {
                    return unsignedSolanaTransactionCodec
                      .decode(tx)
                      .map((v) => ({ type: "solana", tx: v }));
                  }

                  if (isTonChain(network)) {
                    return Either.encase(() => JSON.parse(tx))
                      .mapLeft(() => "Failed to parse tx")
                      .chain((val) => unsignedTonTransactionCodec.decode(val))
                      .map((v) => ({ type: "ton", tx: v }));
                  }

                  if (isTronChain(network)) {
                    return Either.encase(() => JSON.parse(tx))
                      .mapLeft(() => "Failed to parse tx")
                      .chain((val) => unsignedTronTransactionCodec.decode(val))
                      .map((v) => ({ type: "tron", tx: v }) as TronTx);
                  }

                  if (isBittensorChain(network)) {
                    return Either.encase(() => JSON.parse(tx))
                      .mapLeft(() => "Failed to parse tx")
                      .chain((val) => bittensorPayloadCodec.decode(val))
                      .map(
                        (v) => ({ type: "bittensor", tx: v }) as BittensorTx
                      );
                  }

                  return Left("Unsupported network");
                })
                .mapLeft((e) => {
                  console.log(e);
                  return new TransactionDecodeError();
                })
            )
              .chain((val) =>
                conn
                  .sendTransaction(val, txMeta)
                  .mapLeft(
                    (e) =>
                      new SendTransactionError(
                        typeof e === "string" ? e : undefined
                      )
                  )
              )
              .map((val) => ({ signedTx: val, broadcasted: true }));
          }

          if (isSolanaConnector(conn)) {
            return EitherAsync.liftEither(
              unsignedSolanaTransactionCodec.decode(tx)
            )
              .mapLeft(() => new TransactionDecodeError())
              .chain((decodedTx) =>
                EitherAsync(() => conn.sendTransaction(decodedTx))
                  .ifLeft((e) => console.log(e))
                  .mapLeft(() => new SendTransactionError())
              )
              .map((res) => ({ signedTx: res, broadcasted: true }));
          }

          /**
           * Safe connector
           */
          if (isSafeConnector(conn)) {
            return EitherAsync.liftEither(
              Either.encase(() => JSON.parse(tx))
                .chain((val) =>
                  decodeAndPrepareEvmTransaction({ address, input: val })
                )
                .mapLeft(() => new TransactionDecodeError())
            )
              .chain((tx) =>
                conn
                  .sendTransactions({
                    txs: [
                      {
                        data: tx.data,
                        to: tx.to,
                        value: tx.value ?? "0",
                      },
                    ],
                  })
                  .map((res) => res.safeTxHash)
              )
              .chain((safeTxHash) =>
                withRequestErrorRetry({
                  fn: () =>
                    conn
                      .getTxStatus(safeTxHash)
                      .chain((res) =>
                        !res.txHash || res.txStatus !== conn.txStatus.SUCCESS
                          ? EitherAsync.liftEither(
                              Left(
                                new SafeFailedError(
                                  res.txStatus === conn.txStatus.FAILED ||
                                    res.txStatus === conn.txStatus.CANCELLED
                                    ? "FAILED"
                                    : "NOT_READY"
                                )
                              )
                            )
                          : EitherAsync.liftEither(Right(res.txHash))
                      )
                      .run()
                      .then((res) => res.unsafeCoerce()),
                  shouldRetry: (error, retryCount) =>
                    Maybe.fromNullable(error)
                      .chainNullable((e) =>
                        (e as SafeFailedError)._tag === "SafeFailedError"
                          ? (e as SafeFailedError)
                          : null
                      )
                      .filter((e) => e.type !== "FAILED" && !checkIsUnmounted())
                      .map(() => retryCount < 120)
                      .orDefault(false),
                  retryWaitForMs: () => 7000,
                })
              )
              .mapLeft(() => new SendTransactionError())
              .map((val) => ({ signedTx: val as Hash, broadcasted: true }));
          }

          /**
           * EVM connector
           */
          return EitherAsync.liftEither(
            Either.encase(() => JSON.parse(tx))
              .chain((val) => unsignedEVMTransactionCodec.decode(val))
              .mapLeft((e) => {
                console.log(e);
                return new TransactionDecodeError();
              })
          ).chain((val) =>
            EitherAsync(() =>
              /**
               * Params need to be in strict format, don't spread the object(val)!
               */
              sendTransactionAsync({
                data: val.data,
                to: val.to,
                value: val.value,
                nonce: val.nonce,
                maxFeePerGas: val.maxFeePerGas,
                maxPriorityFeePerGas: val.maxPriorityFeePerGas,
                chainId: val.chainId,
                gas: val.gasLimit,
                type: val.maxFeePerGas ? "eip1559" : "legacy",
              })
            )
              .mapLeft(() => new SendTransactionError())
              .map((val) => ({ signedTx: val, broadcasted: true }))
          );
        }),
    [
      connectorDetails,
      cosmosCW,
      ledgerCurrentAccountId,
      sendTransactionAsync,
      checkIsUnmounted,
    ]
  );

  const signMessage = useCallback<SKWallet["signMessage"]>(
    (message) =>
      connectorDetails
        .chain(({ conn }) => {
          if (isExternalProviderConnector(conn)) {
            return conn.signMessage(message);
          }

          return EitherAsync(() => signMessageAsync({ message }));
        })
        .mapLeft((e) => {
          console.log(e);
          return new Error("sign failed");
        }),
    [connectorDetails, signMessageAsync]
  );

  const onLedgerAccountChange = useCallback(
    (account: Account) => {
      if (connector && isLedgerLiveConnector(connector)) {
        connector.switchAccount(account);
      }
    },
    [connector]
  );

  const value = useMemo((): SKWallet => {
    const isLedgerLive =
      isLedgerDappBrowserProvider() ||
      !!(connector && isLedgerLiveConnector(connector));

    const common = {
      disconnect,
      signTransaction,
      signMessage,
      connectorChains,
      isLedgerLive,
    };

    if (isConnected && chain && !isConnecting) {
      return {
        ...common,
        network,
        address,
        chain,
        isConnected: true,
        isConnecting: false,
        additionalAddresses: additionalAddresses.data ?? null,
        ledgerAccounts,
        onLedgerAccountChange,
        connector,
        isLedgerLiveAccountPlaceholder:
          connector &&
          isLedgerLiveConnector(connector) &&
          address === connector.noAccountPlaceholder,
      };
    }

    return {
      ...common,
      network: null,
      address: null,
      chain: null,
      isConnected: false,
      isConnecting,
      additionalAddresses: null,
      ledgerAccounts: null,
      onLedgerAccountChange: null,
      connector: null,
      isLedgerLiveAccountPlaceholder: false,
    };
  }, [
    connectorChains,
    additionalAddresses.data,
    address,
    chain,
    connector,
    disconnect,
    isConnected,
    isConnecting,
    ledgerAccounts,
    network,
    onLedgerAccountChange,
    signTransaction,
    signMessage,
  ]);

  return (
    <SKWalletContext.Provider value={value}>
      {children}
    </SKWalletContext.Provider>
  );
};

export const useSKWallet = () => {
  const value = useContext(SKWalletContext);

  if (value === undefined) {
    throw new Error("useSKWallet must be used within a SKWalletProvider");
  }

  return value;
};
