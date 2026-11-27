import type BigNumber from "bignumber.js";
import {
  Duration,
  Array as EArray,
  Record as ERecord,
  pipe,
  Schema,
} from "effect";

import { exactZero } from "../finance/exact";
import type { PriceRequest } from "../finance/prices";
import {
  type ProviderOption,
  ValidatorAddress,
  YieldId,
} from "../identity/identifiers";
import type { Network } from "../network/network";
import {
  equalTokens,
  type HostTokenKey,
  type Token,
  tokenString,
} from "../token/token";
import {
  YieldCategory,
  type YieldCategory as YieldCategoryType,
  YieldProviderId,
} from "./contract";
import type { EarnProvider } from "./provider";
import {
  validatorAddressIdentities,
  validatorAddressIdentity,
} from "./validator";
import type { EarnYieldWithProvider } from "./yield-schema";

type YieldRiskEntry = NonNullable<
  EarnYieldWithProvider["risk"]
>["ratings"][number];
type KnownYieldRiskRatingSource = YieldRiskEntry["source"];
type YieldRiskRatingSource = KnownYieldRiskRatingSource | (string & {});
export type YieldRiskDisplay = {
  rating: string;
  source: YieldRiskRatingSource;
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
    /** In rank order when `preferredOrder` is `"listed"`. */
    preferred?: ReadonlyArray<string>;
    mergePreferredWithDefault: boolean;
    preferredOnly: boolean;
    preferredOrder: "rewardRate" | "listed";
  }>
>;

/** The default Yield Category order: DeFi first, and so selected first. */
export const yieldCategories = [
  YieldCategory.DeFi,
  YieldCategory.Stake,
  YieldCategory.RWA,
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

/** A network's own Validator Policy, else the wildcard one. */
const validatorPolicyFor = (
  validatorsConfig: ValidatorsConfig,
  network: Network
) => validatorsConfig.get(network) ?? validatorsConfig.get("*") ?? null;

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
  const valConfig = validatorPolicyFor(validatorsConfig, network);

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
        const toAddressIdentities = (addresses: Iterable<string> | undefined) =>
          addresses && new Set(validatorAddressIdentities(addresses));
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

/**
 * Compares validators by where the Validator Policy ranks them: ranked ones
 * first, in its order; unranked ones tie. A policy ranks only the Preferred
 * Validators it names, and only when it lists them in rank order.
 */
const comparePolicyRank = (
  validatorsConfig: ValidatorsConfig,
  network: Network
): ((first: ValidatorDto, second: ValidatorDto) => number) => {
  const policy = validatorPolicyFor(validatorsConfig, network);
  if (policy?.preferredOrder !== "listed") return () => 0;
  const ranks = new Map(
    validatorAddressIdentities(policy.preferred ?? []).map(
      (addressIdentity, rank) => [addressIdentity, rank]
    )
  );
  const rankOf = (validator: ValidatorDto) =>
    validator.preferred
      ? ranks.get(validatorAddressIdentity(validator.address))
      : undefined;

  return (first, second) => {
    const firstRank = rankOf(first);
    const secondRank = rankOf(second);
    if (firstRank === undefined) return secondRank === undefined ? 0 : 1;
    if (secondRank === undefined) return -1;
    return firstRank - secondRank;
  };
};

/**
 * The Eligible Validators among these, Preferred Validators first: those the
 * Validator Policy ranks, in its order, then the others, each group otherwise
 * in its given order.
 */
export const rankedEligibleValidators = <T extends ValidatorDto>({
  network,
  validators,
  validatorsConfig,
  yieldId,
}: {
  readonly network: Network;
  readonly validators: ReadonlyArray<T>;
  readonly validatorsConfig: ValidatorsConfig;
  readonly yieldId: EarnYieldWithProvider["id"];
}): T[] => {
  const byPolicyRank = comparePolicyRank(validatorsConfig, network);

  return filterValidators({
    network,
    validators,
    validatorsConfig,
    yieldId,
  }).sort(
    (first, second) =>
      Number(!!second.preferred) - Number(!!first.preferred) ||
      byPolicyRank(first, second)
  );
};

/**
 * Validators ranked by the Validator Policy first, in its order, then by
 * Validator Reward Rate, highest first.
 */
export const rankedByRewardRate = <
  T extends ValidatorDto & {
    readonly rewardRate?: { readonly total: BigNumber } | null;
  },
>({
  network,
  validators,
  validatorsConfig,
}: {
  readonly network: Network;
  readonly validators: ReadonlyArray<T>;
  readonly validatorsConfig: ValidatorsConfig;
}): T[] => {
  const byPolicyRank = comparePolicyRank(validatorsConfig, network);

  return validators.toSorted(
    (first, second) =>
      byPolicyRank(first, second) ||
      ((second.rewardRate?.total ?? exactZero()).comparedTo(
        first.rewardRate?.total ?? exactZero()
      ) ??
        0)
  );
};

const isValidatorAddress = Schema.is(ValidatorAddress);

/**
 * How a validator list meets a network's Validator Policy. `named` holds the
 * addresses the policy names, which the directory's pages may never reach;
 * `fromDirectory` says which directory validators join them: every one, only
 * the API's Preferred Validators, or none when the named ones are the whole
 * list.
 */
export type ValidatorPolicyListing = {
  readonly fromDirectory: "all" | "preferred" | "none";
  readonly named: ReadonlyArray<ValidatorAddress>;
};

export const getValidatorPolicyListing = ({
  network,
  validatorsConfig,
}: {
  readonly network: Network;
  readonly validatorsConfig: ValidatorsConfig;
}): ValidatorPolicyListing => {
  const policy = validatorPolicyFor(validatorsConfig, network);
  if (!policy) return { fromDirectory: "all", named: [] };

  // Allowed addresses hold every preferred one that is eligible.
  const named = [...(policy.allowed ?? policy.preferred ?? [])]
    .filter((address) => !policy.blocked?.has(address))
    .filter(isValidatorAddress);
  if (policy.allowed) return { fromDirectory: "none", named };
  if (!policy.preferredOnly) return { fromDirectory: "all", named };
  return {
    fromDirectory: policy.mergePreferredWithDefault ? "preferred" : "none",
    named,
  };
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

/**
 * The prices a yield flow values its amounts with: the token it enters with
 * and the yield's gas fee token, in USD.
 */
export const getTokensPricesRequest = ({
  token,
  yieldDto,
}: {
  readonly token: Token | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): PriceRequest | null =>
  token && yieldDto
    ? { currency: "USD", tokenList: [token, yieldDto.mechanics.gasFeeToken] }
    : null;

export const getYieldRiskDisplay = (
  yieldDto: Pick<EarnYieldWithProvider, "risk">
): YieldRiskDisplay | null => {
  const firstRating = yieldDto.risk?.ratings[0];
  const rating = firstRating?.rating.trim();

  if (!firstRating || !rating) return null;

  return { rating, source: firstRating.source };
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

/** The yield's TVL in its token's units, the units of its TVL history. */
export const getYieldTvl = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.statistics?.tvl ?? null;

export const getYieldLockupPeriod = (yieldDto: EarnYieldWithProvider) =>
  secondsToDays(yieldDto.mechanics.lockupPeriod?.seconds);

const secondsToDuration = (seconds: number | undefined) =>
  seconds !== undefined && seconds > 0 ? Duration.seconds(seconds) : null;

/** The yield's exact cooldown, to the second; null without one. */
export const getYieldCooldownDuration = (yieldDto: EarnYieldWithProvider) =>
  secondsToDuration(yieldDto.mechanics.cooldownPeriod?.seconds);

/** The yield's exact lockup, to the second; null without one. */
export const getYieldLockupDuration = (yieldDto: EarnYieldWithProvider) =>
  secondsToDuration(yieldDto.mechanics.lockupPeriod?.seconds);

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

/**
 * What depositing `amount` into the yield returns in its output token, at
 * its price per share when known. Null for a yield without its own token.
 */
export const getYieldOutputAmount = (
  yieldDto: EarnYieldWithProvider,
  amount: BigNumber
) => {
  const token = getYieldOutputToken(yieldDto);
  if (!token) return null;
  const pricePerShare = yieldDto.state?.pricePerShareState?.price;

  return {
    amount: pricePerShare?.isGreaterThan(0)
      ? amount.dividedBy(pricePerShare)
      : amount,
    token,
  };
};

const hasPositivePricePerShare = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.state?.pricePerShareState?.price.isGreaterThan(0) ?? false;

export const hasYieldBearingOutputToken = (yieldDto: EarnYieldWithProvider) =>
  getYieldOutputToken(yieldDto) !== null && hasPositivePricePerShare(yieldDto);

/**
 * A Makina vault: its withdrawal dates are estimates that wait on the
 * provider's finalization, and it reports a deposit capacity.
 */
export const isMakinaYield = (
  yieldDto: Pick<EarnYieldWithProvider, "providerId">
) => yieldDto.providerId === YieldProviderId.Makina;

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
  yieldDto.mechanics.requiresValidatorSelection ||
  isYieldActionArgRequired(yieldDto, "enter", "validatorAddress") ||
  isYieldActionArgRequired(yieldDto, "enter", "validatorAddresses");

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
