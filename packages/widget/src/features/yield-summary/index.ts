import { Data, Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";
import type { YieldId } from "../../domain/schema/identifiers";
import type { ValidatorKey } from "../../domain/types/validators";
import {
  getExtendedYieldType,
  getYieldProviderYieldIds,
  getYieldRewardTokens,
  isYieldWithProviderOptions,
} from "../../domain/types/yields";
import { getRewardRateFormatted } from "../../shared/lib/formatters";
import { MultiYieldsKey, visibleMultiYieldsAtom } from "./multi-yields";

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

type YieldSummaryInput = Readonly<{
  readonly selectedProviderYieldId: YieldId | null;
  readonly validators:
    | ReadonlyMap<ValidatorKey, EarnValidator>
    | ReadonlyArray<EarnValidator>
    | null;
  readonly yield: EarnYieldWithProvider | null;
}>;

export class YieldSummaryKey extends Data.Class<YieldSummaryInput> {
  constructor(input: YieldSummaryInput) {
    super({
      ...input,
      validators:
        input.validators instanceof Map
          ? [...input.validators.values()]
          : input.validators,
    });
  }
}

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

type ProviderYieldsResultAtom = Atom.Atom<
  AsyncResult.AsyncResult<ReadonlyArray<EarnYieldWithProvider> | null, unknown>
>;

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

export const makeYieldSummary = (
  inputAtom: Atom.Atom<YieldSummaryInput>,
  options: {
    readonly providerYieldsResultAtom?: ProviderYieldsResultAtom;
  } = {}
) => {
  const providerYieldsResultAtom =
    options.providerYieldsResultAtom ??
    Atom.make((get) => {
      const selectedYield = get(inputAtom).yield;
      return get(
        visibleMultiYieldsAtom(
          new MultiYieldsKey({
            yieldIds: selectedYield
              ? getYieldProviderYieldIds(selectedYield)
              : [],
          })
        )
      );
    }).pipe(Atom.withLabel("yieldSummaryProviderYieldsResultAtom"));
  const viewAtom = Atom.make((get) => {
    const input = get(inputAtom);
    const selectedYield = input.yield;
    const result = get(providerYieldsResultAtom);
    const value = result.pipe(AsyncResult.value);
    const yields = value.pipe(Option.getOrNull);
    const cause = result.pipe(AsyncResult.error, Option.getOrNull);
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
      waiting: result.waiting,
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
  }).pipe(Atom.withLabel("yieldSummaryFacadeViewAtom"));

  return { viewAtom } as const;
};

export const makeYieldSummaryFamily = () =>
  Atom.family(
    (key: YieldSummaryKey) =>
      makeYieldSummary(Atom.make<YieldSummaryInput>(key)).viewAtom
  );
