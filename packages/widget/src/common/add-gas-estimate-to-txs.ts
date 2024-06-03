import type {
  ActionDto,
  useActionGetGasEstimateHook,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type { ActionDtoWithGasEstimate } from "../domain/types/action";
import { withRequestErrorRetry } from "./utils";

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
