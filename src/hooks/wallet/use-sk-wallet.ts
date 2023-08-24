import { AminoSignResponse, decodeSignature } from "@cosmjs/amino";
import { fromHex } from "@cosmjs/encoding";
import { sendTransaction as wagmiSendTransaction } from "@wagmi/core";
import {
  AuthInfo,
  Fee,
  SignDoc,
  TxBody,
  TxRaw,
} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { StdSignDoc, makeSignDoc } from "@cosmjs/launchpad";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useAccount, useDisconnect, useNetwork } from "wagmi";
import { Hash, SKWallet } from "../../domain/types";
import { PubKey } from "@keplr-wallet/proto-types/cosmos/crypto/secp256k1/keys";
import {
  SendTransactionError,
  TransactionDecodeError,
} from "../../pages/steps/errors";
import { waitForSec } from "../../utils";
import {
  getCosmosChainWallet,
  isCosmosConnector,
  isLedgerLiveConnector,
  wagmiNetworkToSKNetwork,
} from "./utils";
import { useAdditionalAddresses } from "./use-additional-addresses";
import { unsignedTransactionCodec } from "./validation";
import { useLedgerAccounts } from "./use-ledger-accounts";
import { LedgerSigner } from "@cosmjs/ledger-amino";
import { stringToPath } from "@cosmjs/crypto";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Coin } from "@keplr-wallet/proto-types/cosmos/base/v1beta1/coin";
import { transactionSubmit } from "@stakekit/api-hooks";
import Long from "long";
import {
  CosmosTransaction,
  deserializeTransaction,
} from "@ledgerhq/wallet-api-client";
// import {
//   CosmosTransaction,
//   FAMILIES,
//   deserializeTransaction,
// } from "@ledgerhq/live-app-sdk";

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
          return (
            EitherAsync.liftEither(
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
                      ).mapLeft(
                        () => new Error("deserializeTransaction failed")
                      )
                    )
                ).map((deserializedTransaction) => ({
                  ...val,
                  deserializedTransaction,
                }))
              )
              .chain(
                ({ walletApiClient, accountId, deserializedTransaction }) =>
                  EitherAsync(() => {
                    const transaction: CosmosTransaction = {
                      ...deserializedTransaction,
                      family: "cosmos",
                      mode: "delegate",
                      // validators: [
                      //   {
                      //     address: deserializedTransaction.recipient,
                      //     amount: deserializedTransaction.amount,
                      //   },
                      // ],
                    };

                    return walletApiClient.transaction.signAndBroadcast(
                      accountId,
                      transaction,
                      { hwAppId: "Cosmos" }
                    );

                    // return conn.ledgerLiveSdk.signTransaction(
                    //   accountId,
                    //   transaction,
                    //   { useApp: "Cosmos" }
                    // );
                  }).mapLeft((e) => {
                    console.log(e);
                    return new Error("sign failed");
                  })
                // .map((signedTx) => ({ accountId, signedTx }))
              )
              // .chain(({ signedTx, accountId }) =>
              //   EitherAsync(() =>
              //     conn.ledgerLiveSdk.broadcastSignedTransaction(
              //       accountId,
              //       signedTx
              //     )
              //   ).mapLeft(() => new Error("broadcast failed"))
              // )
              // .chain((walletApiClient) => {
              //   return EitherAsync<Error, string>(async () => {
              //     const transport = await walletApiClient.device.transport({
              //       appName: "Cosmos",
              //     });

              //     const parsedTx = JSON.parse(tx);
              //     const parsedSignDoc = JSON.parse(
              //       parsedTx.signDoc
              //     ) as StdSignDoc;

              //     const path = conn.getLedgerPath();

              //     const stdSignDoc = makeSignDoc(
              //       parsedSignDoc.msgs,
              //       parsedSignDoc.fee,
              //       parsedSignDoc.chain_id,
              //       parsedSignDoc.memo,
              //       parsedSignDoc.account_number,
              //       parsedSignDoc.sequence
              //     );

              //     const ledgerSigner = new LedgerSigner(transport, {
              //       hdPaths: [stringToPath("m/" + path)],
              //       // prefix: "osmo",
              //     });

              //     const result = await ledgerSigner.signAmino(
              //       address!,
              //       stdSignDoc
              //     );

              //     const protoMsgs = parsedTx.protoMsgs.reduce((acc, next) => {
              //       acc.push({
              //         typeUrl: next.typeUrl,
              //         value: fromHex(next.value),
              //       });

              //       return acc;
              //     }, [] as ProtoMsg[]);

              //     const txBytes = await postBuildTransaction(result, protoMsgs);
              //     const signed = Buffer.from(txBytes).toString("hex");

              //     const submitResponse = await transactionSubmit(txId, {
              //       signedTransaction: signed,
              //     });

              //     return submitResponse.transactionHash;
              //   });
              // })
              .map((val) => ({ hash: val }))
          );
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
                const broadcast = () =>
                  cw.broadcast({
                    authInfoBytes: val.signed.authInfoBytes,
                    bodyBytes: val.signed.bodyBytes,
                    signatures: [decodeSignature(val.signature).signature],
                  });

                return EitherAsync(broadcast)
                  .chainLeft(
                    () =>
                      EitherAsync(async () => {
                        await waitForSec(2);
                        return broadcast();
                      }) // retry once
                  )
                  .mapLeft(() => new Error("broadcast failed"))
                  .map((val) => ({ hash: val.transactionHash as Hash }));
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
              .map((val) => ({ hash: val.hash as Hash }))
          );
        }
      }),
    [isConnected, network, connector, address]
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

type ProtoMsg = {
  typeUrl: string;
  value: Uint8Array;
};

const postBuildTransaction = async (
  signResponse: AminoSignResponse,
  protoMsgs: Array<ProtoMsg>
): Promise<Uint8Array> => {
  const signed_tx_bytes = TxRaw.encode({
    bodyBytes: TxBody.encode(
      TxBody.fromPartial({
        messages: protoMsgs,
        memo: signResponse.signed.memo,
        timeoutHeight: undefined,
        extensionOptions: [],
        nonCriticalExtensionOptions: [],
      })
    ).finish(),
    authInfoBytes: AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            typeUrl: "/cosmos.crypto.secp256k1.PubKey",
            value: PubKey.encode({
              key: Buffer.from(signResponse.signature.pub_key.value, "base64"),
            }).finish(),
          },
          modeInfo: {
            single: {
              mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
            },
            multi: undefined,
          },
          sequence: Long.fromString(signResponse.signed.sequence),
        },
      ],
      fee: Fee.fromPartial({
        amount: signResponse.signed.fee.amount
          ? (signResponse.signed.fee.amount as Coin[])
          : undefined,
        gasLimit: signResponse.signed.fee.gas,
      }),
    }).finish(),
    signatures: [Buffer.from(signResponse.signature.signature, "base64")],
  }).finish();

  return signed_tx_bytes;
};
