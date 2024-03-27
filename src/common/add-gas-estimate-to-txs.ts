import { APIManager, ActionDto, GasEstimateDto } from "@stakekit/api-hooks";
import { EitherAsync, Maybe } from "purify-ts";
import { withRequestErrorRetry } from "./utils";
import { ActionDtoWithGasEstimate } from "../domain/types/action";
import BigNumber from "bignumber.js";

export const addGasEstimateToTxs = (actionDto: ActionDto) =>
  EitherAsync.liftEither(
    Maybe.fromNullable(APIManager.getInstance()).toEither(
      new Error("APIManager is null")
    )
  ).chain((apiClient) =>
    withRequestErrorRetry({
      fn: () =>
        apiClient
          .get<GasEstimateDto>(`/v1/actions/${actionDto.id}/gas-estimate`)
          .then<ActionDtoWithGasEstimate>(
            (res) =>
              ({
                ...actionDto,
                gasEstimate: {
                  ...res.data,
                  amount: new BigNumber(res.data.amount ?? 0),
                },
              }) satisfies ActionDtoWithGasEstimate
          ),
    }).mapLeft(() => new Error("Gas estimate error"))
  );
