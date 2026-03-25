import type {
  YieldType as LegacyYieldType,
  YieldDto as OldYieldDto,
} from "@stakekit/api-hooks";
import { EvmNetworks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { Maybe } from "purify-ts";
import type { components } from "../../types/yield-api-schema";
import { tokenString } from "..";
import type { SupportedSKChains } from "./chains";
import type { RewardTypes } from "./reward-rate";
import type { TokenString, YieldTokenDto } from "./tokens";
import type { ValidatorDto } from "./validators";

export type Yield = components["schemas"]["YieldDto"] & {
  __fallback__: OldYieldDto;
};

export type YieldApiYieldDto = components["schemas"]["YieldDto"];
export type YieldMetadata = OldYieldDto["metadata"];
export type ExtendedYieldType =
  | LegacyYieldType
  | "liquid-staking"
  | "native_staking"
  | "pooled_staking";
export type YieldActionType = "enter" | "exit";
export type YieldArgumentName =
  components["schemas"]["ArgumentFieldDto"]["name"];

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

export const getBaseYieldType = (
  yieldDto: Yield
): LegacyYieldType | "liquid-staking" => {
  if (yieldDto.__fallback__.metadata.type === "liquid-staking") {
    return "liquid-staking";
  }

  switch (yieldDto.mechanics.type) {
    case "staking":
    case "restaking":
    case "lending":
      return yieldDto.mechanics.type;
    default:
      return "vault";
  }
};

export const getYieldActionArg = (
  yieldDto: Yield,
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
    ...(field.options ? { options: field.options } : {}),
  };
};

export const isYieldActionArgRequired = (
  yieldDto: Yield,
  type: YieldActionType,
  name: YieldArgumentName
) => !!getYieldActionArg(yieldDto, type, name)?.required;

export const getYieldRewardType = (yieldDto: Yield): RewardTypes => {
  const rateType = yieldDto.rewardRate?.rateType?.toLowerCase();

  if (rateType === "apr" || rateType === "apy") {
    return rateType;
  }

  return yieldDto.__fallback__.rewardType ?? "variable";
};

const uniqTokens = (tokens: (YieldTokenDto | null | undefined)[]) => {
  const seen = new Set<TokenString>();

  return tokens.flatMap((token) => {
    if (!token) return [];

    const key = tokenString(token);

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [token];
  });
};

export const getYieldRewardTokens = (yieldDto: Yield) => {
  const derived = uniqTokens(
    yieldDto.rewardRate?.components?.map((component) => component.token) ?? []
  );

  if (derived.length) {
    return derived;
  }

  return yieldDto.__fallback__.metadata.rewardTokens ?? [];
};

export const getYieldProviderDetails = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.provider;

export const hasYieldFeeConfigurationEnabled = (yieldDto: Yield) =>
  (yieldDto.__fallback__.feeConfigurations?.length ?? 0) > 0;

export const getYieldCooldownPeriod = (yieldDto: Yield) =>
  secondsToDays(yieldDto.mechanics.cooldownPeriod?.seconds);

export const getYieldWarmupPeriod = (yieldDto: Yield) =>
  secondsToDays(yieldDto.mechanics.warmupPeriod?.seconds);

export const getYieldWithdrawPeriod = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.withdrawPeriod;

export const getYieldCommission = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.commission;

export const getYieldTVL = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.tvl;

export const getYieldLockupPeriod = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.lockupPeriod;

export const getYieldMetadataTokens = (yieldDto: Yield) =>
  yieldDto.__fallback__.metadata.tokens ?? [];

export const hasYieldExitSignatureVerification = (yieldDto: Yield) =>
  !!yieldDto.__fallback__.args.exit?.args?.signatureVerification?.required;

export const getExtendedYieldType = (yieldDto: Yield) =>
  isNativeStaking(yieldDto)
    ? "native_staking"
    : isPooledStaking(yieldDto)
      ? "pooled_staking"
      : getBaseYieldType(yieldDto);

export const getYieldTypeLabels = (
  yieldDto: Yield,
  t: TFunction
): YieldTypeLabelsMap[keyof YieldTypeLabelsMap] => {
  const map = {
    staking: {
      type: "staking",
      title: t("yield_types.staking.title"),
      review: t("yield_types.staking.review"),
      cta: t("yield_types.staking.cta"),
    },
    "liquid-staking": {
      type: "liquid-staking",
      title: t("yield_types.liquid-staking.title"),
      review: t("yield_types.liquid-staking.review"),
      cta: t("yield_types.liquid-staking.cta"),
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
  } satisfies YieldTypeLabelsMap;

  if (isNativeStaking(yieldDto)) {
    return map.native_staking;
  }

  if (isPooledStaking(yieldDto)) {
    return map.pooled_staking;
  }

  return map[getExtendedYieldType(yieldDto)];
};

const yieldTypesSortRank: { [Key in ExtendedYieldType]: number } = {
  staking: 1,
  native_staking: 2,
  pooled_staking: 3,
  "liquid-staking": 4,
  vault: 5,
  lending: 6,
  restaking: 7,
};

export const getYieldTypesSortRank = (yieldDto: Yield) =>
  yieldTypesSortRank[getExtendedYieldType(yieldDto)];

const isEthereumStaking = (yieldDto: Yield) =>
  yieldDto.mechanics.type === "staking" &&
  yieldDto.token.network === EvmNetworks.Ethereum &&
  yieldDto.token.symbol === "ETH";

const isNativeStaking = (yieldDto: Yield) =>
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

const isPooledStaking = (yieldDto: Yield) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);

export const isYieldWithProviderOptions = (yieldDto: Yield) =>
  !!getYieldActionArg(yieldDto, "enter", "providerId")?.required;

export const getYieldProviderYieldIds = (yieldDto: Yield) =>
  getYieldActionArg(yieldDto, "enter", "providerId")?.options ?? [];

export const hasYieldNftsArg = (yieldDto: Yield) =>
  !!yieldDto.__fallback__.args.enter.args?.nfts;

export const isYieldIntegrationAggregator = (yieldDto: Yield) =>
  !!yieldDto.__fallback__.metadata.isIntegrationAggregator;

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
