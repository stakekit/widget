import type { YieldDto, YieldType } from "@stakekit/api-hooks";
import { EvmNetworks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { useTranslation } from "react-i18next";

export type ExtendedYieldType = YieldType | "native_staking" | "pooled_staking";

type YieldTypeLabelsMap = {
  [Key in ExtendedYieldType]: {
    type: Key;
    title: string;
    review: string;
    cta: string;
  };
};

export const getExtendedYieldType = (yieldDto: YieldDto) =>
  isNativeStaking(yieldDto)
    ? "native_staking"
    : isPooledStaking(yieldDto)
      ? "pooled_staking"
      : yieldDto.metadata.type;

export const getYieldTypeLabels = (
  yieldDto: YieldDto,
  t: ReturnType<typeof useTranslation>["t"]
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

  return map[yieldDto.metadata.type];
};

export const yieldTypesSortRank: { [Key in YieldType]: number } = {
  staking: 1,
  "liquid-staking": 2,
  vault: 3,
  lending: 4,
  restaking: 5,
};

const isEthereumStaking = (yieldDto: YieldDto) =>
  yieldDto.metadata.type === "staking" &&
  yieldDto.token.network === EvmNetworks.Ethereum &&
  yieldDto.token.symbol === "ETH";

const isNativeStaking = (yieldDto: YieldDto) =>
  Maybe.fromFalsy(isEthereumStaking(yieldDto))
    .chain(() => Maybe.fromNullable(yieldDto.args.enter.args?.amount?.minimum))
    .map(BigNumber)
    .filter((v) => v.isEqualTo(32))
    .isJust();

const isPooledStaking = (yieldDto: YieldDto) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);
