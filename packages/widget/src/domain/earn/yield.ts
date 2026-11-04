import type BigNumber from "bignumber.js";
import { Array as EArray, Record as ERecord, pipe, Schema } from "effect";
import type { TFunction } from "i18next";
import { sumExact } from "../finance/exact";
import { type ProviderOption, YieldId } from "../identity/identifiers";
import type { Network } from "../network/network";
import { equalTokens, type HostTokenKey, tokenString } from "../token/token";
import {
  YieldCategory,
  type YieldCategory as YieldCategoryType,
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
  provider?: EarnProvider | undefined;
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

/** Preferred yield ID, or `"*"` for the default choice, per host token key, per network. */
export type PreferredTokenYieldsPerNetwork = Readonly<
  Partial<
    Record<Network, Readonly<Partial<Record<HostTokenKey, YieldId | "*">>>>
  >
>;

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

export const yieldCategories = [
  YieldCategory.RWA,
  YieldCategory.DeFi,
  YieldCategory.Stake,
] as const satisfies ReadonlyArray<YieldCategoryType>;

/**
 * Maps locally known API yield types to Yield Categories. Unknown future
 * API types are intentionally not included in filtered queries because the app
 * cannot infer which Yield Category they belong to.
 */
const apiYieldTypeToYieldCategory = {
  staking: "stake",
  restaking: "stake",
  liquid_staking: "stake",
  lending: "defi",
  vault: "defi",
  fixed_yield: "defi",
  concentrated_liquidity_pool: "defi",
  liquidity_pool: "defi",
  real_world_asset: "rwa",
} as const satisfies Record<KnownApiYieldType, YieldCategoryType>;

export const getApiYieldTypesForYieldCategory = (
  category: YieldCategoryType
): KnownApiYieldType[] =>
  ERecord.keys(apiYieldTypeToYieldCategory).filter(
    (yieldType) => apiYieldTypeToYieldCategory[yieldType] === category
  );

export const getYieldCategory = (
  yieldDto: EarnYieldWithProvider
): YieldCategoryType | null => {
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
        ) => addresses && new Set(validatorAddressIdentities(addresses));
        const allowedIdentities = toAddressIdentities(allowed);
        const blockedIdentities = toAddressIdentities(blocked);
        const preferredIdentities = toAddressIdentities(preferred);

        return validators.flatMap((v): T[] => {
          const addressIdentity = validatorAddressIdentity(v.address);

          if (allowedIdentities && !allowedIdentities.has(addressIdentity)) {
            return [];
          }
          if (blockedIdentities?.has(addressIdentity)) return [];

          const isPreferred =
            preferredIdentities?.has(addressIdentity) ||
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
) => Object.values(yieldDto.mechanics.fee ?? {}).some((fee) => fee != null);

export const getYieldCooldownPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.cooldownPeriod?.seconds);

export const getYieldWarmupPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.warmupPeriod?.seconds);

export const getYieldTvlUsd = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.statistics?.tvlUsd ?? null;

/**
 * The yield's total fee as a decimal ratio (0.02 = 2%), summed exactly from
 * the API's percentages; null when it charges none.
 */
export const getYieldFeePercent = (
  yieldDto: EarnYieldWithProvider
): BigNumber | null => {
  const fees = Object.values(yieldDto.mechanics.fee ?? {}).filter(
    (fee) => fee != null
  );
  const total = sumExact(fees);

  return total.isGreaterThan(0) ? total.dividedBy(100) : null;
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

  const type = yieldDto.mechanics.type;

  return isKnownApiYieldType(type) ? type : "unknown";
};

export const getYieldOutputToken = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.outputToken && !equalTokens(yieldDto.outputToken, yieldDto.token)
    ? yieldDto.outputToken
    : null;

const hasPositivePricePerShare = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.state?.pricePerShareState?.price.isGreaterThan(0) ?? false;

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

  return (
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum.isEqualTo(32) ??
    false
  );
};

const isPooledStaking = (yieldDto: EarnYieldWithProvider) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);

export const getYieldProviderOptions = (
  yieldDto: EarnYieldWithProvider
): ReadonlyArray<ProviderOption> =>
  getYieldActionArg(yieldDto, "enter", "providerId")?.options ?? [];

/**
 * Keeps a still-advertised selection; otherwise defaults to the first option
 * when the argument is required or only one option is advertised.
 */
export const resolveYieldProviderOption = (
  yieldDto: EarnYieldWithProvider,
  selected: ProviderOption | null
): ProviderOption | null => {
  const argument = getYieldActionArg(yieldDto, "enter", "providerId");
  const options = argument?.options ?? [];

  if (selected !== null && options.includes(selected)) return selected;

  return argument?.required || options.length === 1
    ? (options[0] ?? null)
    : null;
};

export const isYieldValidatorSelectionRequired = (
  yieldDto: EarnYieldWithProvider
) =>
  !!(
    yieldDto.mechanics.requiresValidatorSelection ||
    isYieldActionArgRequired(yieldDto, "enter", "validatorAddress") ||
    isYieldActionArgRequired(yieldDto, "enter", "validatorAddresses")
  );

const decodeYieldId = Schema.decodeSync(YieldId);

const ethenaUsdeStakingYieldId = decodeYieldId("ethena-usde-staking");
const bittensorStakingYieldId = decodeYieldId("bittensor-native-staking");

export const isEthenaUsdeStaking = (yieldId: YieldId) =>
  yieldId === ethenaUsdeStakingYieldId;

export const isBittensorStaking = (yieldId: YieldId) =>
  yieldId === bittensorStakingYieldId;

const zeroRewardRateYieldIdWhitelist = new Set<YieldId>([
  decodeYieldId(
    "optimism-usdc-gtusdcb-0x4ffc4e5f1f1f5c43dc9bc27b53728da13b02be35-4626-vault"
  ),
]);

export const isNonZeroRewardRateYield = (
  yieldDto: Pick<EarnYieldWithProvider, "id" | "rewardRate">
) =>
  yieldDto.rewardRate.total.isGreaterThan(0) ||
  zeroRewardRateYieldIdWhitelist.has(yieldDto.id);

/**
 * Yields closed to deposits (`status.enter: false`) that stay visible while
 * their investment schedule pauses deposits. Entry remains disabled for them.
 */
const displayOnlyYields = new Map<
  YieldId,
  { readonly network: Network; readonly yieldType: KnownApiYieldType }
>([
  [
    decodeYieldId("base-usdc-midas-mglo-vault"),
    { network: "base", yieldType: "real_world_asset" },
  ],
  [
    decodeYieldId("robinhood-usdg-midas-mglo-vault"),
    { network: "robinhood", yieldType: "real_world_asset" },
  ],
  [
    decodeYieldId("ethereum-usdc-midas-mglobal-vault"),
    { network: "ethereum", yieldType: "real_world_asset" },
  ],
]);

export const isYieldVisible = (
  yieldDto: Pick<EarnYieldWithProvider, "id" | "status">
) => yieldDto.status.enter || displayOnlyYields.has(yieldDto.id);

/**
 * API yield types that can hold a display-only yield within a token-catalog
 * scope; empty when the scope cannot contain one.
 */
export const getDisplayOnlyYieldTypes = (scope: {
  readonly network?: Network;
  readonly yieldTypes?: ReadonlyArray<KnownApiYieldType>;
}): KnownApiYieldType[] => [
  ...new Set(
    Array.from(displayOnlyYields.values())
      .filter(
        ({ network, yieldType }) =>
          (!scope.network || scope.network === network) &&
          (!scope.yieldTypes || scope.yieldTypes.includes(yieldType))
      )
      .map(({ yieldType }) => yieldType)
  ),
];

type TokenYieldOption = {
  readonly token: Parameters<typeof equalTokens>[0];
  readonly availableYields: ReadonlyArray<YieldId>;
};

/**
 * Adds the display-only yields found among all offered yields to the
 * enterable token options, appending tokens that only offer such yields.
 */
export const withDisplayOnlyYields = <Option extends TokenYieldOption>(
  enterable: ReadonlyArray<Option>,
  offered: ReadonlyArray<Option>
): ReadonlyArray<Option> => {
  const options = [...enterable];

  for (const offeredOption of offered) {
    const displayOnly = offeredOption.availableYields.filter((id) =>
      displayOnlyYields.has(id)
    );
    if (displayOnly.length === 0) continue;

    const index = options.findIndex((option) =>
      equalTokens(option.token, offeredOption.token)
    );
    const option = options[index];
    if (!option) {
      options.push({ ...offeredOption, availableYields: displayOnly });
      continue;
    }

    options[index] = {
      ...option,
      availableYields: [
        ...option.availableYields,
        ...displayOnly.filter((id) => !option.availableYields.includes(id)),
      ],
    };
  }

  return options;
};
