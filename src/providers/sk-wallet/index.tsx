import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { sendTransaction as wagmiSendTransaction } from "@wagmi/core";
import { SKWallet } from "../../domain/types";
import { useAccount, useDisconnect, useNetwork } from "wagmi";
import { useWagmiConfig } from "../wagmi";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { useLedgerAccounts } from "./use-ledger-accounts";
import {
  getCosmosChainWallet,
  isCosmosConnector,
  isLedgerLiveConnector,
  wagmiNetworkToSKNetwork,
} from "./utils";
import { useAdditionalAddresses } from "./use-additional-addresses";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/hooks/errors";
import { Account, deserializeTransaction } from "@ledgerhq/wallet-api-client";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { fromHex, toHex } from "@cosmjs/encoding";
import { decodeSignature } from "@cosmjs/amino";
import { unsignedTransactionCodec } from "./validation";
import { isEVMNetwork } from "../../domain";
import { DirectSignDoc } from "@cosmos-kit/core";
import { useTrackEvent } from "../../hooks/tracking/use-track-event";
import { LedgerLiveConnector } from "../ledger/ledger-connector";

const SKWalletContext = createContext<SKWallet | undefined>(undefined);

export const SKWalletProvider = ({ children }: PropsWithChildren) => {
  const {
    isReconnecting,
    isConnected: _isConnected,
    isConnecting: _isConnecting,
    address,
    connector,
  } = useAccount();

  const { chain } = useNetwork();

  const { disconnectAsync: disconnect } = useDisconnect();

  const ledgerAccounts = useLedgerAccounts(connector);

  const wagmiConfig = useWagmiConfig();

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

  const additionalAddresses = useAdditionalAddresses({
    address,
    connector,
  });

  const isConnected = _isConnected && !!address && !!connector && !!network;
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
  useLayoutEffect(() => {
    if (_isConnected && !isConnected) {
      disconnect();
    }
  }, [_isConnected, disconnect, isConnected]);

  const signTransaction = useCallback<SKWallet["signTransaction"]>(
    ({ index, tx }) =>
      EitherAsync.liftEither(
        !isConnected || !network || !connector
          ? Left(new Error("No wallet connected"))
          : Right({ conn: connector, network })
      ).chain<
        TransactionDecodeError | SendTransactionError,
        { signedTx: string; broadcasted: boolean }
      >(({ conn, network }) => {
        if (isLedgerLiveConnector(conn)) {
          /**
           * Ledger Live connector
           */
          return EitherAsync.liftEither(
            Either.encase(() => conn.getWalletApiClient()).mapLeft(
              () => new Error("getWalletApiClient failed")
            )
          )
            .chain((walletApiClient) =>
              EitherAsync.liftEither(
                Maybe.fromNullable(conn.getCurrentAccountId()).toEither(
                  new Error("getCurrentAccountId failed")
                )
              ).map((val) => ({ walletApiClient, accountId: val }))
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
                ...val,
                deserializedTransaction,
              }))
            )
            .chain(({ walletApiClient, accountId, deserializedTransaction }) =>
              EitherAsync(() => {
                return walletApiClient.transaction.signAndBroadcast(
                  accountId,
                  deserializedTransaction,
                  isEVMNetwork(network) ? { hwAppId: "StakeKit" } : undefined
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
          return getCosmosChainWallet(conn).chain((cw) =>
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
        } else {
          /**
           * EVM connector
           */
          return EitherAsync.liftEither(
            Either.encase(() => JSON.parse(tx))
              .chain((val) => unsignedTransactionCodec.decode(val))
              .mapLeft((e) => {
                console.log(e);
                return new TransactionDecodeError();
              })
          ).chain((val) =>
            EitherAsync(() =>
              wagmiSendTransaction({
                ...val,
                type: "eip1559",
                nonce: val.nonce + index,
                gas: val.gasLimit,
                mode: "prepared",
              })
            )
              .mapLeft((e) => {
                console.log(e);
                return new SendTransactionError();
              })
              .map((val) => ({ signedTx: val.hash, broadcasted: true }))
          );
        }
      }),
    [isConnected, network, connector]
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
    const common = { disconnect, signTransaction };

    if (isConnected && !isConnecting) {
      const isLedgerLive = isLedgerLiveConnector(connector);

      return {
        ...common,
        network,
        address,
        chain,
        isConnected: true,
        isConnecting: false,
        additionalAddresses: additionalAddresses.data ?? null,
        isLedgerLive,
        ledgerAccounts,
        onLedgerAccountChange,
        connector,
        isLedgerLiveAccountPlaceholder:
          address === LedgerLiveConnector.noAccountPlaceholder,
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
      isLedgerLive: false,
      ledgerAccounts: null,
      onLedgerAccountChange: null,
      connector: null,
      isLedgerLiveAccountPlaceholder: false,
    };
  }, [
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
