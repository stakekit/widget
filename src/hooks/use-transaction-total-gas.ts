import { TransactionDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getTransactionTotalGas } from "../domain";

export const useTransactionTotalGas = (txs?: TransactionDto[]) => {
  return useMemo(
    () => Maybe.fromNullable(txs).map(getTransactionTotalGas),
    [txs]
  );
};
