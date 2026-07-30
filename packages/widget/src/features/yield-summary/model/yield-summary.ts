import { Data, Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { ValidatorKey } from "../../../domain/types/validators";
import {
  getExtendedYieldType,
  getYieldRewardTokens,
  isYieldWithProviderOptions,
} from "../../../domain/types/yields";
import { getRewardRateFormatted } from "../../../shared/lib/formatters";

export type YieldSummaryProvider = Readonly<{
  readonly address?: EarnValidator["address"];
  readonly commission?: EarnValidator["commission"];
  readonly logo: string | undefined;
  readonly name: string;
  readonly preferred?: EarnValidator["preferred"];
  readonly rewardRate: number | undefined;
  readonly rewardRateFormatted: string;
  readonly rewardType: string | undefined;
  readonly stakedBalance?: EarnValidator["tvl"];
  readonly status?: EarnValidator["status"];
  readonly votingPower?: EarnValidator["votingPower"];
  readonly website?: EarnValidator["website"];
}>;

export type YieldSummaryInput = Readonly<{
  readonly selectedProviderYieldId: YieldId | null;
  readonly validators:
    | ReadonlyMap<ValidatorKey, EarnValidator>
    | ReadonlyArray<EarnValidator>
    | null;
  readonly yield: EarnYieldWithProvider | null;
}>;

export type YieldSummaryRewardToken = Readonly<{
  readonly logoUri: string | undefined;
  readonly providerName: string;
  readonly rewardTokens: ReturnType<typeof getYieldRewardTokens>;
}>;

class YieldSummaryResourceError extends Data.TaggedError(
  "YieldSummaryResourceError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}> {}

type ProviderYieldsResult = AsyncResult.AsyncResult<
  ReadonlyArray<EarnYieldWithProvider> | null,
  unknown
>;

const getProvider = ({
  selectedProviderYieldId,
  validator,
  yield: selectedYield,
  yields,
}: {
  readonly selectedProviderYieldId: YieldId | null;
  readonly validator: EarnValidator | null;
  readonly yield: EarnYieldWithProvider | null;
  readonly yields: ReadonlyArray<EarnYieldWithProvider>;
}): YieldSummaryProvider | null => {
  if (!selectedYield) return null;

  if (validator) {
    const selectedProviderYield =
      isYieldWithProviderOptions(selectedYield) && selectedProviderYieldId
        ? EArray.findFirst(
            yields,
            (candidate) => candidate.id === selectedProviderYieldId
          ).pipe(Option.getOrNull)
        : null;
    const rewardRate =
      selectedProviderYield?.rewardRate.total ?? validator.rewardRate?.total;

    return {
      address: validator.address,
      commission: validator.commission,
      logo: validator.logoURI,
      name: validator.name ?? validator.address,
      preferred: validator.preferred,
      rewardRate,
      rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
      rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
      stakedBalance: validator.tvl,
      status: validator.status,
      votingPower: validator.votingPower,
      website: validator.website,
    };
  }

  const rewardRate = selectedYield.rewardRate.total;
  const provider = selectedYield.provider;
  return {
    logo: provider?.logoURI ?? selectedYield.metadata.logoURI,
    name: provider?.name ?? selectedYield.metadata.name,
    rewardRate,
    rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    website: provider?.website,
  };
};

const getYieldSummaryProviders = ({
  selectedProviderYieldId,
  validators,
  yield: selectedYield,
  yields,
}: YieldSummaryInput & {
  readonly yields: ReadonlyArray<EarnYieldWithProvider>;
}): YieldSummaryProvider[] | null => {
  if (!validators) return null;

  const values = Array.isArray(validators)
    ? validators
    : [...(validators as ReadonlyMap<ValidatorKey, EarnValidator>).values()];
  const providers = values.map((validator) =>
    getProvider({
      selectedProviderYieldId,
      validator,
      yield: selectedYield,
      yields,
    })
  );
  if (providers.some((provider) => provider === null)) return null;
  if (providers.length > 0) {
    return providers as YieldSummaryProvider[];
  }

  const fallback = getProvider({
    selectedProviderYieldId,
    validator: null,
    yield: selectedYield,
    yields,
  });
  return fallback ? [fallback] : null;
};

export const getYieldSummaryRewardToken = (
  selectedYield: EarnYieldWithProvider | null
): YieldSummaryRewardToken | null => {
  const provider = selectedYield?.provider;
  if (!selectedYield || !provider) return null;
  const rewardTokens = getYieldRewardTokens(selectedYield);

  return {
    logoUri: provider.logoURI,
    providerName: provider.name,
    rewardTokens,
  } as const;
};

const getYieldSummaryStatus = ({
  error,
  hasValue,
  waiting,
}: {
  readonly error: YieldSummaryResourceError | null;
  readonly hasValue: boolean;
  readonly waiting: boolean;
}) => {
  if (!hasValue) return error ? ("failed" as const) : ("loading" as const);
  return waiting ? ("refreshing" as const) : ("ready" as const);
};

export const resolveYieldSummaryView = ({
  input,
  providerYieldsResult,
}: {
  readonly input: YieldSummaryInput;
  readonly providerYieldsResult: ProviderYieldsResult;
}) => {
  const selectedYield = input.yield;
  const value = providerYieldsResult.pipe(AsyncResult.value);
  const yields = value.pipe(Option.getOrNull);
  const cause = providerYieldsResult.pipe(AsyncResult.error, Option.getOrNull);
  const error = cause
    ? new YieldSummaryResourceError({
        cause,
        message: "Yield Summary provider data could not be loaded.",
        retryable: true,
      })
    : null;
  const status = getYieldSummaryStatus({
    error,
    hasValue: Option.isSome(value),
    waiting: providerYieldsResult.waiting,
  });

  return {
    error,
    providers: Option.isNone(value)
      ? null
      : getYieldSummaryProviders({ ...input, yields: yields ?? [] }),
    rewardToken: getYieldSummaryRewardToken(selectedYield),
    status,
    yieldType: selectedYield ? getExtendedYieldType(selectedYield) : null,
  } as const;
};
