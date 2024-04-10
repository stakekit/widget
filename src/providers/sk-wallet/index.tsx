import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { SKWallet } from "../../domain/types";
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSignMessage,
} from "wagmi";
import { useWagmiConfig } from "../wagmi";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { wagmiNetworkToSKNetwork } from "./utils";
import { useAdditionalAddresses } from "./use-additional-addresses";
import {
  NotSupportedFlowError,
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import { Account, deserializeTransaction } from "@ledgerhq/wallet-api-client";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { fromHex, toHex } from "@cosmjs/encoding";
import { decodeSignature } from "@cosmjs/amino";
import { DirectSignDoc } from "@cosmos-kit/core";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { isLedgerLiveConnector } from "../ledger/ledger-connector";
import { useIsomorphicEffect } from "../../hooks/use-isomorphic-effect";
import { Hash, numberToHex } from "viem";
import { isExternalProviderConnector } from "../external-provider";
import { isTronConnector } from "../misc/tron-connector";
import { isCosmosConnector } from "../cosmos/cosmos-connector";
import { useConnectorChains } from "./use-connector-chains";
import { isLedgerDappBrowserProvider } from "../../utils";
import { useLedgerCurrentAccountId } from "./use-ledger-current-account-id";
import { useCosmosCW } from "./use-cosmos-cw";
import {
  unsignedEVMTransactionCodec,
  unsignedTronTransactionCodec,
} from "./validation";
import { TxType } from "../../domain/types/wallets/generic-wallet";

const SKWalletContext = createContext<SKWallet | undefined>(undefined);

export const SKWalletProvider = ({ children }: PropsWithChildren) => {
  const {
    isReconnecting,
    isConnected: _isConnected,
    isConnecting: _isConnecting,
    address,
    connector: _connector,
    chain,
  } = useAccount();

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
    _isConnecting ||
    isReconnecting ||
    wagmiConfig.isLoading ||
    additionalAddresses.isLoading;

  const trackEvent = useTrackEvent();

  useEffect(() => {
    if (!isConnected) return;

    trackEvent("connectedWallet", { address, network });
  }, [address, isConnected, network, trackEvent]);

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
          : Right({
              conn: connector,
              network,
              address,
            })
      ),
    [connector, isConnected, network, address]
  );

  const signTransaction = useCallback<SKWallet["signTransaction"]>(
    ({ tx, ledgerHwAppId }) =>
      connectorDetails.chain<
        TransactionDecodeError | SendTransactionError | NotSupportedFlowError,
        { signedTx: string; broadcasted: boolean }
      >(({ conn, address }) => {
        if (isLedgerLiveConnector(conn)) {
          /**
           * Ledger Live connector
           */
          return EitherAsync.liftEither(
            Maybe.fromNullable(ledgerCurrentAccountId).toEither(
              new Error("currentAccountId missing")
            )
          )
            .chain((val) =>
              EitherAsync.liftEither(
                Either.encase(() => JSON.parse(tx))
                  .mapLeft(() => new Error("JSON.parse failed"))
                  .chain((parsedTx) =>
                    Either.encase(() =>
                      deserializeTransaction(parsedTx)
                    ).mapLeft(() => new Error("deserializeTransaction failed"))
                  )
              ).map((deserializedTransaction) => ({
                accountId: val,
                deserializedTransaction,
              }))
            )
            .chain(({ accountId, deserializedTransaction }) =>
              EitherAsync(() => {
                return conn.walletApiClient.transaction.signAndBroadcast(
                  accountId,
                  deserializedTransaction,
                  Maybe.fromNullable(ledgerHwAppId)
                    .map((v) => ({ hwAppId: v }))
                    .extract()
                );
              }).mapLeft((e) => {
                console.log(e);
                return new Error("sign failed");
              })
            )
            .map((val) => ({ signedTx: val, broadcasted: true }));
        } else if (isCosmosConnector(conn)) {
          /**
           * Cosmos connector
           */
          return EitherAsync.liftEither(
            Maybe.fromNullable(cosmosCW).toEither(new Error("cosmosCW missing"))
          ).chain((cw) =>
            // We need to sign + broadcast as `walletconnect` cosmos client does not support `sendTx`
            EitherAsync(() =>
              cw.client.signDirect!(
                cw.chainId,
                cw.address!,
                SignDoc.decode(fromHex(tx)) as unknown as DirectSignDoc // accountNumber bigint/Long issue
              )
            )
              .mapLeft((e) => {
                console.log(e);
                return new Error("signDirect failed");
              })
              .map((val) => ({
                broadcasted: false,
                signedTx: toHex(
                  TxRaw.encode({
                    authInfoBytes: val.signed.authInfoBytes,
                    bodyBytes: val.signed.bodyBytes,
                    signatures: [decodeSignature(val.signature).signature],
                  }).finish()
                ),
              }))
          );
        } else if (isTronConnector(conn)) {
          /**
           * Tron connector
           */
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
                return new Error("sign failed");
              })
            )
            .map((val) => ({
              signedTx: JSON.stringify(val),
              broadcasted: false,
            }));
        } else if (isExternalProviderConnector(conn)) {
          return EitherAsync.liftEither(
            Either.encase(() => JSON.parse(tx))
              .chain((val) => unsignedEVMTransactionCodec.decode(val))
              .mapLeft((e) => {
                console.log(e);
                return new TransactionDecodeError();
              })
          )
            .chain((val) =>
              conn.sendTransaction({
                to: val.to,
                from: address,
                data: val.data,
                value: val.value ? numberToHex(val.value) : undefined,
                nonce: numberToHex(val.nonce),
                gas: numberToHex(val.gasLimit),
                chainId: numberToHex(val.chainId),
                ...(val.maxFeePerGas
                  ? {
                      type: TxType.EIP1559,
                      maxFeePerGas: numberToHex(val.maxFeePerGas),
                      maxPriorityFeePerGas: val.maxPriorityFeePerGas
                        ? numberToHex(val.maxPriorityFeePerGas)
                        : undefined,
                    }
                  : { type: TxType.Legacy }),
              })
            )
            .map((val) => ({ signedTx: val, broadcasted: true }));
        } else {
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
              .mapLeft((e) => {
                console.log(e);
                return new SendTransactionError();
              })
              .map((val) => ({ signedTx: val, broadcasted: true }))
          );
        }
      }),
    [connectorDetails, cosmosCW, ledgerCurrentAccountId, sendTransactionAsync]
  );

  const signMultipleTransactions = useCallback<
    SKWallet["signMultipleTransactions"]
  >(
    ({ txs }) =>
      connectorDetails.chain<
        TransactionDecodeError | SendTransactionError | NotSupportedFlowError,
        { signedTx: string; broadcasted: boolean }
      >(({ conn, network }) => {
        if (isExternalProviderConnector(conn)) {
          return EitherAsync.liftEither(
            Either.sequence(
              txs.map((tx) =>
                Either.encase(() => JSON.parse(tx))
                  .chain((val) => unsignedEVMTransactionCodec.decode(val))
                  .mapLeft((e) => {
                    console.log(e);
                    return new TransactionDecodeError();
                  })
              )
            ).map((val) =>
              val.map((v) => ({
                data: v.data,
                gas: v.gasLimit.toString(),
                to: v.to,
                value: v.value?.toString() ?? "0",
              }))
            )
          ).chain((val) =>
            conn
              .sendMultipleTransactions({
                network,
                txs: val,
              })
              .map((val) => ({ signedTx: val as Hash, broadcasted: true }))
          );
        } else {
          return EitherAsync.liftEither(Left(new NotSupportedFlowError()));
        }
      }),
    [connectorDetails]
  );

  const signMessage = useCallback<SKWallet["signMessage"]>(
    (message) =>
      connectorDetails
        .chain(({ conn, address }) => {
          if (isExternalProviderConnector(conn)) {
            return conn.signMessage(address, message);
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
      signMultipleTransactions,
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
    signMultipleTransactions,
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
