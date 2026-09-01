import { Array as EArray, pipe, Schema } from "effect";
import type { TFunction } from "i18next";
import { exactDecimal } from "../finance/exact";
import { YieldId } from "../identity/identifiers";
import type { Network } from "../network/network";
import { equalTokens, tokenString } from "../token/token";
import {
  DashboardYieldCategory,
  type DashboardYieldCategory as DashboardYieldCategoryType,
} from "./contract";
import type { EarnProvider, EarnYieldWithProvider } from "./models";
import {
  validatorAddressIdentities,
  validatorAddressIdentity,
} from "./validator";

type YieldRiskRatingTone = "positive" | "warning" | "danger" | "neutral";
type YieldRiskEntry = NonNullable<
  EarnYieldWithProvider["risk"]
>["ratings"][number];
type KnownYieldRiskRatingSource = YieldRiskEntry["source"];
type YieldRiskRatingSource = KnownYieldRiskRatingSource | (string & {});
export type YieldRiskDisplay = {
  rating: string;
  source: YieldRiskRatingSource;
  tone: YieldRiskRatingTone;
};
export type YieldMetadata = Pick<
  EarnYieldWithProvider["metadata"],
  "logoURI" | "name"
> & {
  provider?: EarnProvider;
};

const knownApiYieldTypes = [
  "staking",
  "restaking",
  "lending",
  "vault",
  "fixed_yield",
  "real_world_asset",
  "concentrated_liquidity_pool",
  "liquidity_pool",
  "liquid_staking",
] as const satisfies ReadonlyArray<EarnYieldWithProvider["mechanics"]["type"]>;

export type KnownApiYieldType = (typeof knownApiYieldTypes)[number];
type LocallyDerivedYieldType = "native_staking" | "pooled_staking";
type KnownExtendedYieldType = KnownApiYieldType | LocallyDerivedYieldType;
export type ExtendedYieldType = KnownExtendedYieldType | "unknown";
type YieldActionType = "enter" | "exit";
type YieldArguments = NonNullable<
  EarnYieldWithProvider["mechanics"]["arguments"]
>;
type YieldArgumentFields = NonNullable<YieldArguments["enter"]>["fields"];
type YieldArgumentName = keyof YieldArgumentFields;

type ValidatorDto = {
  readonly address: string;
  readonly name?: string | null;
  readonly preferred?: boolean;
};

type YieldTypeLabelsMap = {
  [Key in ExtendedYieldType]: {
    type: Key;
    title: string;
    review: string;
    cta: string;
  };
};

export type ValidatorsConfig = ReadonlyMap<
  Network | "*",
  Readonly<{
    allowed?: ReadonlySet<string>;
    blocked?: ReadonlySet<string>;
    preferred?: ReadonlySet<string>;
    mergePreferredWithDefault: boolean;
    preferredOnly: boolean;
  }>
>;

export const dashboardYieldCategories = [
  DashboardYieldCategory.RWA,
  DashboardYieldCategory.DeFi,
  DashboardYieldCategory.Stake,
] as const satisfies ReadonlyArray<DashboardYieldCategoryType>;

/**
 * Maps locally known API yield types to dashboard categories. Unknown future
 * API types are intentionally not included in filtered queries because the app
 * cannot infer which dashboard category they belong to.
 */
const apiYieldTypeToDashboardCategory = {
  staking: "stake",
  restaking: "stake",
  liquid_staking: "stake",
  lending: "defi",
  vault: "defi",
  fixed_yield: "defi",
  concentrated_liquidity_pool: "defi",
  liquidity_pool: "defi",
  real_world_asset: "rwa",
} as const satisfies Record<KnownApiYieldType, DashboardYieldCategoryType>;

export const getApiYieldTypesForDashboardCategory = (
  category: DashboardYieldCategoryType
): KnownApiYieldType[] =>
  (
    Object.entries(apiYieldTypeToDashboardCategory) as [
      KnownApiYieldType,
      DashboardYieldCategoryType,
    ][]
  )
    .filter(([, mapped]) => mapped === category)
    .map(([yieldType]) => yieldType);

export const getDashboardYieldCategory = (
  yieldDto: EarnYieldWithProvider
): DashboardYieldCategoryType | null => {
  const yieldType = getExtendedYieldType(yieldDto);

  if (yieldType === "real_world_asset") return "rwa";

  if (isStakingYieldType(yieldType) || yieldType === "restaking") {
    return "stake";
  }

  if (isDepositYieldType(yieldType)) return "defi";

  return null;
};

export const filterValidators = <T extends ValidatorDto>({
  validatorsConfig,
  validators,
  network,
  yieldId,
}: {
  validatorsConfig: ValidatorsConfig;
  validators: ReadonlyArray<T>;
  network: EarnYieldWithProvider["token"]["network"];
  yieldId?: EarnYieldWithProvider["id"];
}): T[] => {
  const valConfig =
    validatorsConfig.get(network) ?? validatorsConfig.get("*") ?? null;

  const filtered = !valConfig
    ? [...validators]
    : (() => {
        const {
          allowed,
          blocked,
          preferred,
          mergePreferredWithDefault,
          preferredOnly,
        } = valConfig;
        // A wildcard policy must be normalized against the concrete network.
        const toAddressIdentities = (
          addresses: ReadonlySet<string> | undefined
        ) =>
          addresses && new Set(validatorAddressIdentities(network, addresses));
        const allowedIdentities = toAddressIdentities(allowed);
        const blockedIdentities = toAddressIdentities(blocked);
        const preferredIdentities = toAddressIdentities(preferred);

        return validators.flatMap((v) => {
          const addressIdentity = validatorAddressIdentity(network, v.address);

          if (allowedIdentities && !allowedIdentities.has(addressIdentity)) {
            return [];
          }
          if (blockedIdentities?.has(addressIdentity)) return [];

          const isPreferred =
            preferredIdentities?.has(addressIdentity) ||
            !!(mergePreferredWithDefault && v.preferred);

          if (preferredOnly) {
            return isPreferred ? [{ ...v, preferred: true } as T] : [];
          }

          return [{ ...v, preferred: isPreferred } as T];
        });
      })();

  if (yieldId && isBittensorStaking(yieldId)) {
    return filtered.filter((validator) => validator.name?.match(/yuma/i));
  }

  return filtered;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const secondsToDays = (seconds: number | undefined) => {
  if (seconds === undefined) return undefined;

  return { days: Math.round(seconds / 86400) };
};

export const getYieldActionArg = <Name extends YieldArgumentName>(
  yieldDto: EarnYieldWithProvider,
  type: YieldActionType,
  name: Name
): YieldArgumentFields[Name] | null =>
  yieldDto.mechanics.arguments?.[type]?.fields[name] ?? null;

export const isYieldActionArgRequired = <Name extends YieldArgumentName>(
  yieldDto: EarnYieldWithProvider,
  type: YieldActionType,
  name: Name
) => !!getYieldActionArg(yieldDto, type, name)?.required;

export const getYieldRewardTokens = (yieldDto: EarnYieldWithProvider) =>
  pipe(
    [
      ...(yieldDto.outputToken ? [yieldDto.outputToken] : []),
      ...(yieldDto.rewardRate?.components?.map(
        (component) => component.token
      ) ?? []),
    ],
    EArray.dedupeWith((a, b) => tokenString(a) === tokenString(b)),
    EArray.filter((token) => tokenString(token) !== tokenString(yieldDto.token))
  );

const getRiskTone = (rating: string): YieldRiskRatingTone => {
  const normalizedRating = rating.trim().toUpperCase();

  if (normalizedRating.startsWith("A")) return "positive";
  if (normalizedRating.startsWith("B")) return "warning";
  if (
    ["C", "D", "E", "F"].some((prefix) => normalizedRating.startsWith(prefix))
  ) {
    return "danger";
  }

  return "neutral";
};

export const getYieldRiskDisplay = (
  yieldDto: Pick<EarnYieldWithProvider, "risk">
): YieldRiskDisplay | null => {
  const firstRating = yieldDto.risk?.ratings[0];
  const rating = firstRating?.rating.trim();

  if (!firstRating || !rating) return null;

  return {
    rating,
    source: firstRating.source,
    tone: getRiskTone(rating),
  };
};

export const getYieldRiskSourceLabel = (
  source: YieldRiskRatingSource,
  t: TFunction
) => {
  switch (source) {
    case "credora":
      return t("details.risk.sources.credora");
    case "stakingRewards":
      return t("details.risk.sources.staking_rewards");
    default:
      return source;
  }
};

export const hasYieldFeeConfigurationEnabled = (
  yieldDto: EarnYieldWithProvider
) => Object.values(yieldDto.mechanics.fee ?? {}).some(Boolean);

export const getYieldCooldownPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.cooldownPeriod?.seconds);

export const getYieldWarmupPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.warmupPeriod?.seconds);

export const getYieldTvlUsd = (yieldDto: EarnYieldWithProvider) => {
  const tvlUsd = yieldDto.statistics?.tvlUsd;

  if (tvlUsd == null || tvlUsd === "") return null;

  return tvlUsd;
};

export const getYieldFeePercent = (
  yieldDto: EarnYieldWithProvider
): number | null => {
  const fee = yieldDto.mechanics.fee;

  if (!fee) return null;

  const total = Object.values(fee).reduce((acc, value) => {
    const parsed = toNumber(value);

    return parsed !== undefined ? acc + parsed : acc;
  }, 0);

  if (total <= 0) return null;

  return total / 100;
};

export const getYieldLockupPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.lockupPeriod?.seconds);

const knownApiYieldTypeValues = new Set<string>(knownApiYieldTypes);

const isKnownApiYieldType = (type: string): type is KnownApiYieldType =>
  knownApiYieldTypeValues.has(type);

export const getExtendedYieldType = (
  yieldDto: EarnYieldWithProvider
): ExtendedYieldType => {
  if (isNativeStaking(yieldDto)) {
    return "native_staking";
  }

  if (isPooledStaking(yieldDto)) {
    return "pooled_staking";
  }

  const type = yieldDto.mechanics.type as string;

  return isKnownApiYieldType(type) ? type : "unknown";
};

export const getYieldOutputToken = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.outputToken && !equalTokens(yieldDto.outputToken, yieldDto.token)
    ? yieldDto.outputToken
    : null;

const hasPositivePricePerShare = (yieldDto: EarnYieldWithProvider) => {
  const price = yieldDto.state?.pricePerShareState?.price;

  if (price === null || price === undefined) return false;

  const amount = exactDecimal(price);

  return amount.isFinite() && amount.isGreaterThan(0);
};

export const hasYieldBearingOutputToken = (yieldDto: EarnYieldWithProvider) =>
  getYieldOutputToken(yieldDto) !== null && hasPositivePricePerShare(yieldDto);

const isStakingYieldType = (yieldType: ExtendedYieldType) =>
  yieldType === "staking" ||
  yieldType === "liquid_staking" ||
  yieldType === "native_staking" ||
  yieldType === "pooled_staking";

export const isUnstakeYieldType = (yieldType: ExtendedYieldType) =>
  isStakingYieldType(yieldType) || yieldType === "restaking";

export const isDepositYieldType = (yieldType: ExtendedYieldType) =>
  yieldType === "lending" ||
  yieldType === "vault" ||
  yieldType === "fixed_yield" ||
  yieldType === "real_world_asset" ||
  yieldType === "concentrated_liquidity_pool" ||
  yieldType === "liquidity_pool";

export const getYieldTypeLabels = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): YieldTypeLabelsMap[keyof YieldTypeLabelsMap] => {
  const map = {
    staking: {
      type: "staking",
      title: t("yield_types.staking.title"),
      review: t("yield_types.staking.review"),
      cta: t("yield_types.staking.cta"),
    },
    vault: {
      type: "vault",
      title: t("yield_types.vault.title"),
      review: t("yield_types.vault.review"),
      cta: t("yield_types.vault.cta"),
    },
    lending: {
      type: "lending",
      title: t("yield_types.lending.title"),
      review: t("yield_types.lending.review"),
      cta: t("yield_types.lending.cta"),
    },
    restaking: {
      type: "restaking",
      title: t("yield_types.restaking.title"),
      review: t("yield_types.restaking.review"),
      cta: t("yield_types.restaking.cta"),
    },
    liquid_staking: {
      type: "liquid_staking",
      title: t("yield_types.liquid-staking.title"),
      review: t("yield_types.liquid-staking.review"),
      cta: t("yield_types.liquid-staking.cta"),
    },
    fixed_yield: {
      type: "fixed_yield",
      title: t("yield_types.fixed_yield.title"),
      review: t("yield_types.fixed_yield.review"),
      cta: t("yield_types.fixed_yield.cta"),
    },
    real_world_asset: {
      type: "real_world_asset",
      title: t("yield_types.real_world_asset.title"),
      review: t("yield_types.real_world_asset.review"),
      cta: t("yield_types.real_world_asset.cta"),
    },
    concentrated_liquidity_pool: {
      type: "concentrated_liquidity_pool",
      title: t("yield_types.concentrated_liquidity_pool.title"),
      review: t("yield_types.concentrated_liquidity_pool.review"),
      cta: t("yield_types.concentrated_liquidity_pool.cta"),
    },
    liquidity_pool: {
      type: "liquidity_pool",
      title: t("yield_types.liquidity_pool.title"),
      review: t("yield_types.liquidity_pool.review"),
      cta: t("yield_types.liquidity_pool.cta"),
    },
    native_staking: {
      type: "native_staking",
      title: t("yield_types.native_staking.title"),
      review: t("yield_types.native_staking.review"),
      cta: t("yield_types.native_staking.cta"),
    },
    pooled_staking: {
      type: "pooled_staking",
      title: t("yield_types.pooled_staking.title"),
      review: t("yield_types.pooled_staking.review"),
      cta: t("yield_types.pooled_staking.cta"),
    },
    unknown: {
      type: "unknown",
      title: "Yield",
      review: "Earn",
      cta: "Earn",
    },
  } satisfies YieldTypeLabelsMap;

  return map[getExtendedYieldType(yieldDto)];
};

const yieldTypesSortRank: { [Key in ExtendedYieldType]: number } = {
  real_world_asset: 1,
  staking: 2,
  liquid_staking: 3,
  native_staking: 4,
  pooled_staking: 5,
  restaking: 6,
  lending: 7,
  vault: 8,
  fixed_yield: 9,
  liquidity_pool: 10,
  concentrated_liquidity_pool: 11,
  unknown: 12,
};

export const getYieldTypesSortRank = (yieldDto: EarnYieldWithProvider) =>
  yieldTypesSortRank[getExtendedYieldType(yieldDto)];

const isEthereumStaking = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.mechanics.type === "staking" &&
  yieldDto.token.network === "ethereum" &&
  yieldDto.token.symbol === "ETH";

const isNativeStaking = (yieldDto: EarnYieldWithProvider) => {
  if (
    !isEthereumStaking(yieldDto) ||
    !isYieldActionArgRequired(yieldDto, "enter", "amount")
  ) {
    return false;
  }

  const minimum = getYieldActionArg(yieldDto, "enter", "amount")?.minimum;

  return minimum !== null && minimum !== undefined
    ? exactDecimal(minimum).isEqualTo(32)
    : false;
};

const isPooledStaking = (yieldDto: EarnYieldWithProvider) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);

export const isYieldWithProviderOptions = (yieldDto: EarnYieldWithProvider) =>
  !!getYieldActionArg(yieldDto, "enter", "providerId")?.required;

export const getYieldProviderYieldIds = (yieldDto: EarnYieldWithProvider) =>
  Schema.decodeSync(Schema.Array(YieldId))(
    getYieldActionArg(yieldDto, "enter", "providerId")?.options ?? []
  );

export const isYieldValidatorSelectionRequired = (
  yieldDto: EarnYieldWithProvider
) =>
  !!(
    yieldDto.mechanics.requiresValidatorSelection ||
    isYieldActionArgRequired(yieldDto, "enter", "validatorAddress") ||
    isYieldActionArgRequired(yieldDto, "enter", "validatorAddresses")
  );

export const isEthenaUsdeStaking = (yieldId: string) =>
  yieldId === "ethena-usde-staking";

export const isBittensorStaking = (yieldId: string) =>
  yieldId === "bittensor-native-staking";

const zeroRewardRateYieldIdWhitelist = new Set<string>([
  "optimism-usdc-gtusdcb-0x4ffc4e5f1f1f5c43dc9bc27b53728da13b02be35-4626-vault",
]);

export const isNonZeroRewardRateYield = (
  yieldDto: Pick<EarnYieldWithProvider, "id" | "rewardRate">
) =>
  yieldDto.rewardRate.total.isGreaterThan(0) ||
  zeroRewardRateYieldIdWhitelist.has(yieldDto.id);
