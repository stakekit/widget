import { ActionDto, useActionGetGasEstimateHook } from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "./utils";
import { ActionDtoWithGasEstimate } from "../domain/types/action";
import BigNumber from "bignumber.js";

export const addGasEstimateToTxs = ({
  actionDto,
  gasEstimate,
}: {
  actionDto: ActionDto;
  gasEstimate: ReturnType<typeof useActionGetGasEstimateHook>;
}) =>
  withRequestErrorRetry({
    fn: () =>
      gasEstimate(actionDto.id).then<ActionDtoWithGasEstimate>(
        (res) =>
          ({
            ...actionDto,
            gasEstimate: {
              ...res,
              amount: new BigNumber(res.amount ?? 0),
            },
          }) satisfies ActionDtoWithGasEstimate
      ),
  }).mapLeft(() => new Error("Gas estimate error"));
