import { Ref } from "effect";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type {
  DirectTransactionLedger,
  DirectTransactionRecord,
} from "../transaction-workflow-model";

/**
 * Records what became of a Direct transaction; `null` forgets it, so it signs
 * again.
 */
export const recordDirectTransaction = (
  ledger: DirectTransactionLedger,
  transaction: DirectTransaction,
  record: Omit<DirectTransactionRecord, "transaction"> | null
) =>
  Ref.update(ledger, (current) => {
    const next = new Map(current);
    if (record) next.set(transaction.id, { ...record, transaction });
    else next.delete(transaction.id);
    return next;
  });
