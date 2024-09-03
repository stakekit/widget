import type { Account } from "@ledgerhq/wallet-api-client";
import { config } from "@sk-widget/config";
import { useInit } from "@sk-widget/providers/sk-wallet/use-init";
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
import type { SKWallet } from "../../domain/types";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { useIsomorphicEffect } from "../../hooks/use-isomorphic-effect";
import {
  NotSupportedFlowError,
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import { isLedgerDappBrowserProvider } from "../../utils";
import { isCosmosConnector } from "../cosmos/cosmos-connector-meta";
import { isExternalProviderConnector } from "../external-provider";
import { isLedgerLiveConnector } from "../ledger/ledger-live-connector-meta";
import { isTronConnector } from "../misc/tron-connector-meta";
import { useWagmiConfig } from "../wagmi";
import { useAdditionalAddresses } from "./use-additional-addresses";
import { useConnectorChains } from "./use-connector-chains";
import { useCosmosCW } from "./use-cosmos-cw";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { useLedgerCurrentAccountId } from "./use-ledger-current-account-id";
import { useSyncExternalProvider } from "./use-sync-external-provider";
import {
  chainsToSKNetworks,
  prepareEVMTx,
  wagmiNetworkToSKNetwork,
} from "./utils";
import {
  unsignedEVMTransactionCodec,
  unsignedTronTransactionCodec,
} from "./validation";

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

  const connectorSKNetworks = useMemo(
    () =>
      Maybe.fromNullable(wagmiConfig.data)
        .map((w) =>
          chainsToSKNetworks({
            chains: connectorChains,
            evmChainsMap: w.evmConfig.evmChainsMap,
            cosmosChainsMap: w.cosmosConfig.cosmosChainsMap,
            miscChainsMap: w.miscConfig.miscChainsMap,
            substrateChainsMap: w.substrateConfig.substrateChainsMap,
          })
        )
        .orDefault([]),
    [wagmiConfig.data, connectorChains]
  );

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
        /**
         * Ledger Live connector
         */
        if (isLedgerLiveConnector(conn)) {
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
                      conn.deserializeTransaction(parsedTx)
                    ).mapLeft(() => new Error("deserializeTransaction failed"))
                  )
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
                return new Error("sign failed");
              })
            )
            .map((val) => ({ signedTx: val, broadcasted: true }));
        }

        /**
         * Cosmos connector
         */
        if (isCosmosConnector(conn)) {
          return EitherAsync.liftEither(
            Maybe.fromNullable(cosmosCW).toEither(new Error("cosmosCW missing"))
          ).chain((cw) =>
            // We need to sign + broadcast as `walletconnect` cosmos client does not support `sendTx`
            conn
              .signTransaction({ cw, tx })
              .map((val) => ({ signedTx: val, broadcasted: false }))
          );
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
                return new Error("sign failed");
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
            Either.encase(() => JSON.parse(tx))
              .chain((val) => unsignedEVMTransactionCodec.decode(val))
              .mapLeft((e) => {
                console.log(e);
                return new TransactionDecodeError();
              })
          )
            .chain((val) =>
              conn.sendTransaction(prepareEVMTx({ address, decodedTx: val }))
            )
            .map((val) => ({ signedTx: val, broadcasted: true }));
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
            .mapLeft((e) => {
              console.log(e);
              return new SendTransactionError();
            })
            .map((val) => ({ signedTx: val, broadcasted: true }))
        );
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
      >(({ conn, network, address }) => {
        if (isExternalProviderConnector(conn)) {
          return EitherAsync.liftEither(
            Either.sequence(
              txs.map((tx) =>
                Either.encase(() => JSON.parse(tx))
                  .chain((val) => unsignedEVMTransactionCodec.decode(val))
                  .map((val) => prepareEVMTx({ address, decodedTx: val }))
                  .mapLeft((e) => {
                    console.log(e);
                    return new TransactionDecodeError();
                  })
              )
            )
          ).chain((val) =>
            conn
              .sendMultipleTransactions({
                network,
                txs: val,
              })
              .map((val) => ({ signedTx: val as Hash, broadcasted: true }))
          );
        }

        return EitherAsync.liftEither(Left(new NotSupportedFlowError()));
      }),
    [connectorDetails]
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
      signMultipleTransactions,
      signMessage,
      connectorChains,
      connectorSKNetworks,
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
    connectorSKNetworks,
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
