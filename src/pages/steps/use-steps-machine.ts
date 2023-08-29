import { EitherAsync, Left, Right } from "purify-ts";
import useStateMachine, { t } from "@cassiozen/usestatemachine";
import { $$t } from "@cassiozen/usestatemachine/dist/types";
import {
  GetStakeSessionError,
  MissingHashError,
  SendTransactionError,
  SubmitError,
  TransactionConstructError,
} from "./errors";
import { Override } from "../../types/utils";
import {
  stakeGetStakeSession,
  transactionConstruct,
  transactionGetTransactionStatusFromId,
  transactionSubmitHash,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../hooks/wallet/use-sk-wallet";
import { getValidStakeSessionTx, isTxError } from "../../domain";
import { getAverageGasMode } from "../../api/get-gas-mode-value";
import { withRetry } from "../../utils";

const tt = t as <T extends unknown>() => {
  [$$t]: T;
};

export const useStepsMachine = () => {
  const { sendTransaction, isLedgerLive } = useSKWallet();

  return useStateMachine({
    initial: "idle",
    schema: {
      context: tt<{
        signError:
          | Error
          | GetStakeSessionError
          | SendTransactionError
          | SubmitError
          | null;
        txCheckError: GetStakeSessionError | null;
        txCheckTimeoutId: number | null;
        urls: string[];
      }>(),
      events: {
        START: tt<{ id: string }>(),
        SIGN_RETRY: tt<{ id: string }>(),
        SIGN_SUCCESS: tt<{ id: string }>(),
        RETRY: tt<{ id: string }>(),
        TX_CHECK_RETRY: tt<{ id: string }>(),
      },
    },
    context: {
      signError: null,
      txCheckError: null,
      txCheckTimeoutId: null,
      urls: [],
    },
    states: {
      idle: {
        on: { START: "signLoading" },
      },
      signLoading: {
        on: { SIGN_SUCCESS: "txCheckLoading", SIGN_ERROR: "signError" },
        effect: ({ send, setContext, event }) => {
          const id = event.id;

          EitherAsync(() => stakeGetStakeSession(id))
            .mapLeft(() => new GetStakeSessionError())
            .chain((val) => EitherAsync.liftEither(getValidStakeSessionTx(val)))
            .chain((val) =>
              EitherAsync.sequence(
                val.transactions
                  .filter(
                    (
                      tx
                    ): tx is Override<
                      typeof tx,
                      { unsignedTransaction: string }
                    > => !!tx.unsignedTransaction
                  )
                  .map((tx, i) =>
                    getAverageGasMode(tx.network)
                      .chainLeft(async () => Right(null))
                      .chain((gas) =>
                        EitherAsync(() =>
                          transactionConstruct(tx.id, {
                            gasArgs: gas?.gasArgs,
                            // @ts-expect-error
                            ledgerWalletAPICompatible: isLedgerLive,
                          })
                        ).mapLeft((e) => {
                          console.log(e);
                          return new TransactionConstructError();
                        })
                      )
                      .chain((tx) => {
                        if (!tx.unsignedTransaction) {
                          return EitherAsync.liftEither(Right(undefined));
                        }

                        return sendTransaction({
                          tx: tx.unsignedTransaction,
                          txId: tx.id,
                          index: i,
                        }).chain((val) =>
                          EitherAsync(async () => {
                            if (val.broadcasted) return;

                            transactionSubmitHash(tx.id, { hash: val.hash });
                          }).mapLeft(() => new SubmitError())
                        );
                      })
                  )
              )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                setContext((ctx) => ({ ...ctx, signError: l }));
                send("SIGN_ERROR");
              },
              Right: () => send({ type: "SIGN_SUCCESS", id }),
            });
        },
      },
      signError: {
        on: { SIGN_RETRY: "signLoading" },
      },
      txCheckLoading: {
        on: {
          TX_CHECK_SUCCESS: "done",
          TX_CHECK_ERROR: "txCheckError",
          TX_CHECK_RETRY: "txCheckRetry",
        },
        effect: ({ send, event, setContext }) => {
          const id = event.id;

          EitherAsync(() => stakeGetStakeSession(id))
            .mapLeft(() => new GetStakeSessionError())
            .chain((val) => EitherAsync.liftEither(getValidStakeSessionTx(val)))
            .chain((val) =>
              EitherAsync.sequence(
                val.transactions.map((tx) =>
                  EitherAsync(
                    withRetry({
                      retryTimes: 2,
                      fn: () => transactionGetTransactionStatusFromId(tx.id),
                    })
                  )
                    .mapLeft(() => new MissingHashError())
                    .chain((result) =>
                      EitherAsync.liftEither(
                        isTxError(result)
                          ? Left(new SubmitError())
                          : Right({
                              result,
                              isConfirmed: result.status === "CONFIRMED",
                            })
                      )
                    )
                )
              )
            )
            .caseOf({
              Left: (l) => {
                console.log(l);
                setContext((ctx) => ({ ...ctx, txCheckError: l }));
                send("TX_CHECK_ERROR");
              },
              Right: (v) => {
                if (v.every((val) => val.isConfirmed)) {
                  setContext((ctx) => ({
                    ...ctx,
                    urls: v.map((val) => val.result.url),
                  }));
                  send("TX_CHECK_SUCCESS");
                } else {
                  send({ type: "TX_CHECK_RETRY", id });
                }
              },
            });
        },
      },
      txCheckRetry: {
        on: { TX_CHECK_RETRY: "txCheckLoading" },
        effect: ({ send, event, setContext }) => {
          const id = event.id;

          const timeoutHandler = setTimeout(() => {
            send({ type: "TX_CHECK_RETRY", id });
          }, 4000);

          setContext((ctx) => ({
            ...ctx,
            txCheckTimeoutId: timeoutHandler as unknown as number,
          }));
        },
      },
      txCheckError: {
        on: { TX_CHECK_RETRY: "txCheckLoading" },
      },
      done: {},
    },
  });
};
