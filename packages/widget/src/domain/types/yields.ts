import BigNumber from "bignumber.js";
import { Array as EArray, pipe } from "effect";
import type { TFunction } from "i18next";
import { Maybe } from "purify-ts";
import type {
  YieldType as ApiYieldType,
  ArgumentFieldDto,
  ProviderDto,
  ValidatorDto,
  YieldDto as YieldApiYieldDto,
  YieldRiskEntryDto,
} from "../../generated/api/yield";
import type { SupportedSKChains } from "./chains";
import { EvmNetworks } from "./chains/networks";
import { equalTokens, tokenString } from "./tokens";

export type YieldProviderDetails = ProviderDto;

export type Yield = YieldApiYieldDto & {
  provider?: YieldProviderDetails;
};

export type YieldBase = Yield;

type YieldRiskRatingTone = "positive" | "warning" | "danger" | "neutral";
type KnownYieldRiskRatingSource = YieldRiskEntryDto["source"];
type YieldRiskRatingSource = KnownYieldRiskRatingSource | (string & {});
export type YieldRiskDisplay = {
  rating: string;
  source: YieldRiskRatingSource;
  tone: YieldRiskRatingTone;
};
export type YieldMetadata = Pick<
  YieldApiYieldDto["metadata"],
  "logoURI" | "name"
> & {
  provider?: YieldProviderDetails;
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
] as const satisfies ReadonlyArray<ApiYieldType>;

type KnownApiYieldType = (typeof knownApiYieldTypes)[number];
type LocallyDerivedYieldType = "native_staking" | "pooled_staking";
type KnownExtendedYieldType = KnownApiYieldType | LocallyDerivedYieldType;
export type ExtendedYieldType = KnownExtendedYieldType | "unknown";
type YieldActionType = "enter" | "exit";
type YieldArgumentName = ArgumentFieldDto["name"];

type YieldArgumentConfig = {
  required?: boolean;
  minimum?: number | null;
  maximum?: number | null;
  options?: string[];
} & Record<string, unknown>;

type YieldTypeLabelsMap = {
  [Key in ExtendedYieldType]: {
    type: Key;
    title: string;
    review: string;
    cta: string;
  };
};

export type ValidatorsConfig = Map<
  SupportedSKChains | "*",
  {
    allowed?: Set<string>;
    blocked?: Set<string>;
    preferred?: Set<string>;
    mergePreferredWithDefault: boolean;
    preferredOnly: boolean;
  }
>;

export const DashboardYieldCategory = {
  RWA: "rwa",
  DeFi: "defi",
  Stake: "stake",
} as const;

export type DashboardYieldCategory =
  (typeof DashboardYieldCategory)[keyof typeof DashboardYieldCategory];

export const dashboardYieldCategories = [
  DashboardYieldCategory.RWA,
  DashboardYieldCategory.DeFi,
  DashboardYieldCategory.Stake,
] as const satisfies ReadonlyArray<DashboardYieldCategory>;

const dashboardYieldCategoryValues = new Set<string>(dashboardYieldCategories);

export const normalizeDashboardYieldCategoryOrder = (
  order?: ReadonlyArray<unknown> | null
): DashboardYieldCategory[] => {
  const normalized: DashboardYieldCategory[] = [];

  for (const category of order ?? []) {
    if (
      typeof category === "string" &&
      dashboardYieldCategoryValues.has(category) &&
      !normalized.includes(category as DashboardYieldCategory)
    ) {
      normalized.push(category as DashboardYieldCategory);
    }
  }

  for (const category of dashboardYieldCategories) {
    if (!normalized.includes(category)) {
      normalized.push(category);
    }
  }

  return normalized;
};

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
} as const satisfies Record<KnownApiYieldType, DashboardYieldCategory>;

export const getApiYieldTypesForDashboardCategory = (
  category: DashboardYieldCategory
): KnownApiYieldType[] =>
  (
    Object.entries(apiYieldTypeToDashboardCategory) as [
      KnownApiYieldType,
      DashboardYieldCategory,
    ][]
  )
    .filter(([, mapped]) => mapped === category)
    .map(([yieldType]) => yieldType);

export const getDashboardYieldCategory = (
  yieldDto: YieldBase
): DashboardYieldCategory | null => {
  const yieldType = getExtendedYieldType(yieldDto);

  if (yieldType === "real_world_asset") return "rwa";

  if (isStakingYieldType(yieldType) || yieldType === "restaking") {
    return "stake";
  }

  if (isDepositYieldType(yieldType)) return "defi";

  return null;
};

export const filterValidators = ({
  validatorsConfig,
  validators,
  network,
  yieldId,
}: {
  validatorsConfig: ValidatorsConfig;
  validators: ValidatorDto[];
  network: Yield["token"]["network"];
  yieldId?: Yield["id"];
}) => {
  const valConfig = Maybe.fromNullable(
    validatorsConfig.get(network as SupportedSKChains)
  )
    .altLazy(() => Maybe.fromNullable(validatorsConfig.get("*")))
    .extractNullable();

  const filtered = !valConfig
    ? validators
    : (() => {
        const {
          allowed,
          blocked,
          preferred,
          mergePreferredWithDefault,
          preferredOnly,
        } = valConfig;

        return validators.flatMap((v) => {
          if (allowed && !allowed.has(v.address)) return [];
          if (blocked?.has(v.address)) return [];

          const isPreferred =
            preferred?.has(v.address) ||
            !!(mergePreferredWithDefault && v.preferred);

          if (preferredOnly) {
            return isPreferred ? [{ ...v, preferred: true }] : [];
          }

          return [{ ...v, preferred: isPreferred }];
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

export const getYieldActionArg = (
  yieldDto: YieldBase,
  type: YieldActionType,
  name: YieldArgumentName
): YieldArgumentConfig | null => {
  const field = yieldDto.mechanics.arguments?.[type]?.fields?.find(
    (item) => item.name === name
  );

  if (!field) {
    return null;
  }

  return {
    required: !!field.required,
    minimum: toNumber(field.minimum),
    maximum: toNumber(field.maximum),
    ...(field.options ? { options: [...field.options] } : {}),
  };
};

export const isYieldActionArgRequired = (
  yieldDto: YieldBase,
  type: YieldActionType,
  name: YieldArgumentName
) => !!getYieldActionArg(yieldDto, type, name)?.required;

export const getYieldRewardTokens = (yieldDto: YieldBase) =>
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
  yieldDto: Pick<Yield, "risk">
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

export const hasYieldFeeConfigurationEnabled = (yieldDto: Yield) =>
  Object.values(yieldDto.mechanics.fee ?? {}).some(Boolean);

export const getYieldCooldownPeriod = (yieldDto: Yield) =>
  secondsToDays(yieldDto.mechanics.cooldownPeriod?.seconds);

export const getYieldWarmupPeriod = (yieldDto: Yield) =>
  secondsToDays(yieldDto.mechanics.warmupPeriod?.seconds);

export const getYieldTvlUsd = (yieldDto: Yield) => {
  const tvlUsd = yieldDto.statistics?.tvlUsd;

  if (tvlUsd == null || tvlUsd === "") return null;

  return tvlUsd;
};

export const getYieldFeePercent = (yieldDto: Yield): number | null => {
  const fee = yieldDto.mechanics.fee;

  if (!fee) return null;

  const total = Object.values(fee).reduce((acc, value) => {
    const parsed = toNumber(value);

    return parsed !== undefined ? acc + parsed : acc;
  }, 0);

  if (total <= 0) return null;

  return total / 100;
};

export const getYieldLockupPeriod = (yieldDto: Yield) =>
  secondsToDays(yieldDto.mechanics.lockupPeriod?.seconds);

const knownApiYieldTypeValues = new Set<string>(knownApiYieldTypes);

const isKnownApiYieldType = (type: string): type is KnownApiYieldType =>
  knownApiYieldTypeValues.has(type);

export const getExtendedYieldType = (
  yieldDto: YieldBase
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

export const getYieldOutputToken = (yieldDto: YieldBase) =>
  Maybe.fromNullable(yieldDto.outputToken).filter(
    (outputToken) => !equalTokens(outputToken, yieldDto.token)
  );

const hasPositivePricePerShare = (yieldDto: YieldBase) => {
  const price = yieldDto.state?.pricePerShareState?.price;

  if (price === null || price === undefined) return false;

  const amount = BigNumber(price);

  return amount.isFinite() && amount.isGreaterThan(0);
};

export const hasYieldBearingOutputToken = (yieldDto: YieldBase) =>
  getYieldOutputToken(yieldDto).isJust() && hasPositivePricePerShare(yieldDto);

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
  yieldDto: YieldBase,
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

export const getYieldTypesSortRank = (yieldDto: YieldBase) =>
  yieldTypesSortRank[getExtendedYieldType(yieldDto)];

const isEthereumStaking = (yieldDto: YieldBase) =>
  yieldDto.mechanics.type === "staking" &&
  yieldDto.token.network === EvmNetworks.Ethereum &&
  yieldDto.token.symbol === "ETH";

const isNativeStaking = (yieldDto: YieldBase) =>
  Maybe.fromFalsy(isEthereumStaking(yieldDto))
    .chain(() =>
      Maybe.fromFalsy(
        isYieldActionArgRequired(yieldDto, "enter", "amount")
      ).chain(() =>
        Maybe.fromNullable(
          getYieldActionArg(yieldDto, "enter", "amount")?.minimum
        )
      )
    )
    .map(BigNumber)
    .filter((v) => v.isEqualTo(32))
    .isJust();

const isPooledStaking = (yieldDto: YieldBase) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);

export const isYieldWithProviderOptions = (yieldDto: YieldBase) =>
  !!getYieldActionArg(yieldDto, "enter", "providerId")?.required;

export const getYieldProviderYieldIds = (yieldDto: YieldBase) =>
  getYieldActionArg(yieldDto, "enter", "providerId")?.options ?? [];

export const isYieldValidatorSelectionRequired = (yieldDto: Yield) =>
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
  yieldDto: Pick<Yield, "id" | "rewardRate">
) =>
  (yieldDto.rewardRate?.total ?? 0) > 0 ||
  zeroRewardRateYieldIdWhitelist.has(yieldDto.id);

export const isERC4626 = (yieldDto: Yield) =>
  yieldDto.metadata.supportedStandards?.includes("ERC4626") ?? false;
