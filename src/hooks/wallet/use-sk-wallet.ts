import { decodeSignature } from "@cosmjs/amino";
import { fromHex, toHex } from "@cosmjs/encoding";
import { sendTransaction as wagmiSendTransaction } from "@wagmi/core";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useAccount, useDisconnect, useNetwork } from "wagmi";
import { SKWallet } from "../../domain/types";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/errors";
import {
  getCosmosChainWallet,
  isCosmosConnector,
  isLedgerLiveConnector,
  wagmiNetworkToSKNetwork,
} from "./utils";
import { useAdditionalAddresses } from "./use-additional-addresses";
import { unsignedTransactionCodec } from "./validation";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { Account, deserializeTransaction } from "@ledgerhq/wallet-api-client";
import { useWagmiConfig } from "../../providers/wagmi";

export const useSKWallet = (): SKWallet => {
  const {
    isReconnecting,
    isConnected: _isConnected,
    isConnecting,
    address,
    connector,
  } = useAccount();

  const ledgerAccounts = useLedgerAccounts(connector);

  const isConnected = _isConnected && !!address && !!connector;

  const { chain } = useNetwork();

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
          })
        )
        .extractNullable(),
    [chain, wagmiConfig.data]
  );

  const { disconnectAsync: disconnect } = useDisconnect();

  const { data: additionalAddresses } = useAdditionalAddresses({
    address,
    connector,
  });

  const signTransaction = useCallback<SKWallet["signTransaction"]>(
    ({ index, tx }) =>
      EitherAsync.liftEither(
        !isConnected || !network || !connector
          ? Left(new Error("No wallet connected"))
          : Right({ conn: connector, network })
      ).chain<
        TransactionDecodeError | SendTransactionError,
        { signedTx: string; broadcasted: boolean }
      >(({ conn }) => {
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
                  deserializedTransaction
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
                SignDoc.decode(fromHex(tx))
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
    const common = { disconnect, signTransaction, isReconnecting };

    if (isConnected && address && network) {
      const isLedgerLive = isLedgerLiveConnector(connector);

      return {
        ...common,
        network,
        address,
        chain,
        isConnected: true,
        isConnecting: false,
        isNotConnectedOrReconnecting: false,
        additionalAddresses: additionalAddresses ?? null,
        isLedgerLive,
        ledgerAccounts,
        onLedgerAccountChange,
      };
    }

    return {
      ...common,
      network: null,
      address: null,
      chain: null,
      isConnected: false,
      isConnecting,
      isNotConnectedOrReconnecting:
        !wagmiConfig.isLoading && !isReconnecting && !isConnecting,
      additionalAddresses: null,
      isLedgerLive: false,
      ledgerAccounts: null,
      onLedgerAccountChange: null,
    };
  }, [
    disconnect,
    signTransaction,
    isConnected,
    address,
    network,
    isConnecting,
    connector,
    chain,
    additionalAddresses,
    isReconnecting,
    wagmiConfig,
    ledgerAccounts,
    onLedgerAccountChange,
  ]);

  return value;
};
