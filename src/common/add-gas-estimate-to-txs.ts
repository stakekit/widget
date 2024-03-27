import {
  APIManager,
  ActionDto,
  GasEstimateDto,
  TransactionDto,
} from "@stakekit/api-hooks";
import { getValidStakeSessionTx } from "../domain";
import { EitherAsync, Maybe } from "purify-ts";
import { withRequestErrorRetry } from "./utils";

export const addGasEstimateToTxs = (actionDto: ActionDto) =>
  EitherAsync.liftEither(
    Maybe.fromNullable(APIManager.getInstance()).toEither(
      new Error("APIManager is null")
    )
  )
    .chain((apiClient) =>
      EitherAsync.liftEither(getValidStakeSessionTx(actionDto)).chain(
        (actionWithValidTxs) =>
          EitherAsync.sequence(
            actionWithValidTxs.transactions.map((tx) =>
              withRequestErrorRetry({
                fn: () =>
                  apiClient
                    .get<GasEstimateDto>(`/v1/actions/${tx.id}/gas-estimate`)
                    .then<TransactionDto>(
                      (res) =>
                        ({
                          ...tx,
                          gasEstimate: res.data,
                        }) satisfies TransactionDto
                    ),
              }).mapLeft(() => new Error("Gas estimate error"))
            )
          )
      )
    )
    .map<ActionDto>((constructedTxs) => {
      const mapped = new Map(constructedTxs.map((val) => [val.id, val]));

      return {
        ...actionDto,
        transactions: actionDto.transactions.map((v) => mapped.get(v.id) ?? v),
      };
    });
