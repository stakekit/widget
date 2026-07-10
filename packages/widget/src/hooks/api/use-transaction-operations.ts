import { useAtomSet } from "@effect/atom-react";
import { Schema } from "effect";
import {
  SubmitSignedTransactionCommand,
  SubmitTransactionHashCommand,
  TransactionStatusCommand,
} from "../../domain/schema/action-models";
import {
  getTransactionStatusAtom,
  submitSignedTransactionAtom,
  submitTransactionHashAtom,
} from "./transaction-atoms";

export const useTransactionOperations = () => {
  const submitHash = useAtomSet(submitTransactionHashAtom, { mode: "promise" });
  const submitSigned = useAtomSet(submitSignedTransactionAtom, {
    mode: "promise",
  });
  const getStatus = useAtomSet(getTransactionStatusAtom, { mode: "promise" });

  return {
    getStatus: (transactionId: string) =>
      getStatus(
        Schema.decodeUnknownSync(TransactionStatusCommand)({ transactionId })
      ),
    submitHash: (transactionId: string, hash: string) =>
      submitHash(
        Schema.decodeUnknownSync(SubmitTransactionHashCommand)({
          transactionId,
          payload: { hash },
        })
      ),
    submitSigned: (transactionId: string, signedTransaction: string) =>
      submitSigned(
        Schema.decodeUnknownSync(SubmitSignedTransactionCommand)({
          transactionId,
          payload: { signedTransaction },
        })
      ),
  } as const;
};
