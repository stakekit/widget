import type { ActionTypes, TokenDto, YieldDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import type { i18n } from "i18next";
import { Maybe } from "purify-ts";
import { APToPercentage, defaultFormattedNumber, formatNumber } from ".";
import { getTokenPriceInUSD } from "../domain";
import { Prices } from "../domain/types";

export const formatCountryCode = ({
  language,
  countryCode,
}: {
  language: string;
  countryCode: string;
}) => {
  return new Intl.DisplayNames([language], { type: "region" }).of(countryCode);
};

export const getRewardRateFormatted = (
  opts: Pick<YieldDto, "rewardType"> & { rewardRate: number | undefined }
) => {
  const { rewardRate, rewardType } = opts;

  if (rewardType === "variable" || !rewardRate) {
    return "- %";
  }

  return `${APToPercentage(rewardRate)}%`;
};

export const getRewardTypeFormatted = (rewardType: YieldDto["rewardType"]) => {
  switch (rewardType) {
    case "apr":
      return "APR";

    case "apy":
      return "APY";

    default:
      return "";
  }
};

export const getGasFeeInUSD = ({
  yieldDto,
  gas,
  prices,
}: {
  yieldDto: Maybe<YieldDto>;
  gas: Maybe<BigNumber>;
  prices: Maybe<Prices>;
}) =>
  Maybe.fromRecord({
    yieldDto,
    gas,
  })
    .map((val) => ({
      ...val,
      gasFeeInUSD: getTokenPriceInUSD({
        amount: val.gas.toString(),
        prices: prices.orDefault(new Prices(new Map())),
        token: val.yieldDto.metadata.gasFeeToken,
        pricePerShare: null,
        baseToken: null,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${formatNumber(val.gas, 10)} ${val.yieldDto.metadata.gasFeeToken.symbol} ${
          val.gasFeeInUSD.isGreaterThan(0)
            ? ` ($${defaultFormattedNumber(val.gasFeeInUSD)})`
            : ""
        }`,
      ""
    );

export const getFeesInUSD = ({
  amount,
  prices,
  token,
}: {
  amount: Maybe<BigNumber>;
  token: Maybe<TokenDto>;
  prices: Maybe<Prices>;
}) =>
  Maybe.fromRecord({ token, amount })
    .map((val) => ({
      ...val,
      feeInUSD: getTokenPriceInUSD({
        amount: val.amount,
        prices: prices.orDefault(new Prices(new Map())),
        token: val.token,
        pricePerShare: null,
        baseToken: null,
      }),
    }))
    .mapOrDefault(
      (val) =>
        `${formatNumber(val.amount, 10)} ${val.token.symbol} ${
          val.feeInUSD.isGreaterThan(0)
            ? ` ($${defaultFormattedNumber(val.feeInUSD)})`
            : ""
        }`,
      ""
    );

export const formatActionName = (action: ActionTypes | undefined) =>
  Maybe.fromNullable(action).mapOrDefault(
    (a) => a.replace(/_/g, " "),
    "Action"
  );

export const groupDateStrings = (
  dateStrings: string[],
  i18n: i18n
): [string[], number[]] => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const formatDate = (date: Date): string =>
    date.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const labelsMap: { [key: string]: string } = {};
  const countMap: { [key: string]: number } = {};

  dateStrings.forEach((dateString) => {
    const date = new Date(dateString);
    let label: string;

    if (date.toDateString() === today.toDateString()) {
      label = "today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "yesterday";
    } else {
      label = formatDate(date);
    }

    if (countMap[label]) {
      countMap[label]++;
    } else {
      countMap[label] = 1;
      labelsMap[label] = label;
    }
  });

  const labels = Object.values(labelsMap);
  const counts = Object.values(countMap);

  return [labels, counts];
};

export const capitalizeFirstLetters = (text: string): string =>
  Maybe.fromNullable(text)
    .map((t) =>
      t
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    )
    .orDefault("");
