import { decodeSignature } from "@cosmjs/amino";
import { fromHex } from "@cosmjs/encoding";
import { sendTransaction as wagmiSendTransaction } from "@wagmi/core";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useAccount, useDisconnect, useNetwork } from "wagmi";
import { SKWallet } from "../../domain/types";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/errors";
import { withRetry } from "../../utils";
import {
  getCosmosChainWallet,
  isCosmosConnector,
  isLedgerLiveConnector,
  wagmiNetworkToSKNetwork,
} from "./utils";
import { useAdditionalAddresses } from "./use-additional-addresses";
import { unsignedTransactionCodec } from "./validation";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { transactionSubmit } from "@stakekit/api-hooks";
import {
  CosmosTransaction,
  deserializeTransaction,
} from "@ledgerhq/wallet-api-client";
import BigNumber from "bignumber.js";

export const useSKWallet = (): SKWallet => {
  const {
    isConnected: _isConnected,
    isConnecting,
    address,
    connector,
  } = useAccount();

  const ledgerAccounts = useLedgerAccounts(connector);

  const isConnected = _isConnected && !!address && !!connector;

  const { chain } = useNetwork();

  const network = useMemo(
    () =>
      Maybe.fromNullable(chain)
        .map((val) => wagmiNetworkToSKNetwork(val))
        .extractNullable(),
    [chain]
  );

  const { disconnectAsync: disconnect } = useDisconnect();

  const { data: additionalAddresses } = useAdditionalAddresses({
    address,
    connector,
  });

  const sendTransaction = useCallback<SKWallet["sendTransaction"]>(
    ({ index, tx, txId }) =>
      EitherAsync.liftEither(
        !isConnected || !network || !connector
          ? Left(new Error("No wallet connected"))
          : Right(connector)
      ).chain((conn) => {
        if (isLedgerLiveConnector(conn)) {
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
                const transaction: CosmosTransaction = {
                  ...deserializedTransaction,
                  mode: "delegate",
                  family: "cosmos",
                  amount: new BigNumber(100000),
                  recipient:
                    "cosmosvaloper15urq2dtp9qce4fyc85m6upwm9xul3049e02707",
                };

                return walletApiClient.transaction.sign(
                  accountId,
                  transaction,
                  { hwAppId: "Cosmos" }
                );
              }).mapLeft((e) => {
                console.log(e);
                return new Error("sign failed");
              })
            )
            .chain((signedTx) =>
              EitherAsync(() =>
                transactionSubmit(txId, {
                  signedTransaction: signedTx.toString(),
                })
              )
                .mapLeft(() => new Error("broadcast failed"))
                .map((val) => val.transactionHash)
            )
            .map((val) => ({ hash: val, broadcasted: true as boolean }));
        } else if (isCosmosConnector(conn)) {
          return getCosmosChainWallet(conn).chain((cw) =>
            // We need to sign + broadcast as `walletconnect` cosmos client does not support `sendTx`
            EitherAsync(() =>
              cw.client.signDirect!(
                cw.chainId,
                cw.address!,
                SignDoc.decode(fromHex(tx))
              )
            )
              .mapLeft(() => new Error("signDirect failed"))
              .chain((val) => {
                return EitherAsync(
                  withRetry({
                    fn: () =>
                      cw.broadcast({
                        authInfoBytes: val.signed.authInfoBytes,
                        bodyBytes: val.signed.bodyBytes,
                        signatures: [decodeSignature(val.signature).signature],
                      }),
                    retryTimes: 2,
                  })
                )
                  .mapLeft(() => new Error("broadcast failed"))
                  .map((val) => ({
                    hash: val.transactionHash,
                    broadcasted: false,
                  }));
              })
          );
        } else {
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
              .map((val) => ({ hash: val.hash, broadcasted: false }))
          );
        }
      }),
    [isConnected, network, connector]
  );

  const value = useMemo((): SKWallet => {
    const common = { disconnect, sendTransaction };

    if (isConnected && address && network) {
      const isLedgerLive = isLedgerLiveConnector(connector);

      return {
        ...common,
        network,
        address,
        chain,
        isConnected: true,
        isConnecting: false,
        additionalAddresses: additionalAddresses ?? null,
        isLedgerLive,
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
    };
  }, [
    disconnect,
    sendTransaction,
    isConnected,
    address,
    network,
    isConnecting,
    connector,
    chain,
    additionalAddresses,
  ]);

  return value;
};
