import type { PositionsData } from "@sk-widget/domain/types/positions";
import type { YieldDto, YieldType } from "@stakekit/api-hooks";
import { EvmNetworks } from "@stakekit/common";
import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { Just, Maybe } from "purify-ts";

export type ExtendedYieldType = YieldType | "pooled_staking";

type YieldTypeLabelsMap = {
  [Key in ExtendedYieldType]: {
    type: Key;
    title: string;
    review: string;
    cta: string;
  };
};

export const getExtendedYieldType = (yieldDto: YieldDto) =>
  Just(
    (isPooledStaking(yieldDto)
      ? "pooled_staking"
      : yieldDto.metadata.type) as ExtendedYieldType
  ).unsafeCoerce();

export const getYieldTypeLabelsMap = (t: TFunction) =>
  ({
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
    pooled_staking: {
      type: "pooled_staking",
      title: t("yield_types.pooled_staking.title"),
      review: t("yield_types.pooled_staking.review"),
      cta: t("yield_types.pooled_staking.cta"),
    },
  }) satisfies YieldTypeLabelsMap;

export const getYieldTypeLabels = (
  yieldDto: YieldDto,
  t: TFunction
): YieldTypeLabelsMap[keyof YieldTypeLabelsMap] => {
  const map = getYieldTypeLabelsMap(t);

  if (isPooledStaking(yieldDto)) {
    return map.pooled_staking;
  }

  return map[yieldDto.metadata.type];
};

const yieldTypesSortRank: { [Key in ExtendedYieldType]: number } = {
  staking: 1,
  pooled_staking: 2,
  "liquid-staking": 3,
  vault: 4,
  lending: 5,
  restaking: 6,
};

export const getYieldTypesSortRank = (val: ExtendedYieldType | YieldDto) =>
  typeof val === "string"
    ? yieldTypesSortRank[val]
    : yieldTypesSortRank[getExtendedYieldType(val)];

const isEthereumStaking = (yieldDto: YieldDto) =>
  yieldDto.metadata.type === "staking" &&
  yieldDto.token.network === EvmNetworks.Ethereum &&
  yieldDto.token.symbol === "ETH";

const isNativeStaking = (yieldDto: YieldDto) =>
  Maybe.fromFalsy(isEthereumStaking(yieldDto))
    .chain(() =>
      Maybe.fromFalsy(yieldDto.args.enter.args?.amount?.required).chain(() =>
        Maybe.fromNullable(yieldDto.args.enter.args?.amount?.minimum)
      )
    )
    .map(BigNumber)
    .filter((v) => v.isEqualTo(32))
    .isJust();

const isPooledStaking = (yieldDto: YieldDto) =>
  isEthereumStaking(yieldDto) && !isNativeStaking(yieldDto);

const yieldsWithEnterMinBasedOnPosition = new Set([
  "polkadot-dot-validator-staking",
]);

export const shouldForceEnterMinToZero = (
  yieldId: YieldDto["id"],
  positionsData: PositionsData
) => {
  if (!yieldsWithEnterMinBasedOnPosition.has(yieldId)) return false;

  return Maybe.fromNullable(positionsData.get("polkadot-dot-validator-staking"))
    .map((val) => [...val.balanceData.values()])
    .map((val) => val.some((v) => v.balances.some((b) => b.type === "staked")))
    .orDefault(false);
};
