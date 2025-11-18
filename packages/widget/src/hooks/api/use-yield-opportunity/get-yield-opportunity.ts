import type { YieldDto } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { yieldYieldOpportunity } from "../../../common/private-api";
import {
  filterMapValidators,
  getComputedRewardRate,
  isBittensorStaking,
  isEthenaUsdeStaking,
  type ValidatorsConfig,
} from "../../../domain/types/yields";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  validatorsConfig: ValidatorsConfig;
  signal?: AbortSignal;
};

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];

export const getYieldOpportunity = (
  params: Params & {
    queryClient: QueryClient;
  }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getKey(params),
      staleTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

export const queryFn = async (
  params: Params & {
    signal?: AbortSignal;
  }
) => (await fn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  yieldId,
  signal,
  validatorsConfig,
}: Params & {
  signal?: AbortSignal;
}) =>
  EitherAsync(() =>
    yieldYieldOpportunity(
      yieldId,
      {
        ledgerWalletAPICompatible: isLedgerLive,
      },
      signal
    )
  )
    .map((y) => filterMapValidators(validatorsConfig, y))
    .map((y) =>
      isEthenaUsdeStaking(y.id)
        ? ({
            ...y,
            rewardRate: getComputedRewardRate(y),
            metadata: {
              ...y.metadata,
              name: y.metadata.name.replace(/staking/i, ""),
            },
          } satisfies YieldDto)
        : isBittensorStaking(y.id)
          ? {
              ...y,
              validators: y.validators.filter((v) => v.name?.match(/yuma/i)),
            }
          : y
    )
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
