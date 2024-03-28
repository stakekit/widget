import { ActionDto, GasEstimateDto } from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "./utils";
import { ActionDtoWithGasEstimate } from "../domain/types/action";
import BigNumber from "bignumber.js";
import { useApiClient } from "../providers/api/api-client-provider";

export const addGasEstimateToTxs = ({
  apiClient,
  actionDto,
}: {
  apiClient: ReturnType<typeof useApiClient>;
  actionDto: ActionDto;
}) =>
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
  }).mapLeft(() => new Error("Gas estimate error"));
