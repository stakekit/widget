import type BigNumber from "bignumber.js";
import { exactDecimal } from "../../../../domain/finance/exact";
import {
  formatNumber,
  getLocaleNumberSymbols,
} from "../../../lib/number-format";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getGroupPattern = (group: string) =>
  /\s/u.test(group) ? "[ \\u00a0\\u202f]" : escapeRegExp(group);

const getInputPattern = (locale: string) => {
  const { decimal, group } = getLocaleNumberSymbols(locale);
  const decimalPattern = escapeRegExp(decimal);
  const groupPattern = getGroupPattern(group);
  const integerPattern = `(?:0|[1-9]\\d*|[1-9]\\d{0,2}(?:${groupPattern}\\d{3})+)`;

  return new RegExp(
    `^(?:${integerPattern}(?:${decimalPattern}\\d*)?|${decimalPattern}\\d*)$`,
    "u"
  );
};

export const isLocalizedNumberInput = (value: string, locale: string) =>
  value === "" || getInputPattern(locale).test(value);

export const parseLocalizedNumberInput = (
  value: string,
  locale: string
): BigNumber | null => {
  if (!/\d/u.test(value) || !isLocalizedNumberInput(value, locale)) {
    return null;
  }

  const { decimal, group } = getLocaleNumberSymbols(locale);
  const normalized = value
    .replace(new RegExp(getGroupPattern(group), "gu"), "")
    .replace(decimal, ".");
  const parsed = exactDecimal(normalized);

  return parsed.isFinite() ? parsed : null;
};

export const formatLocalizedNumber = ({
  locale,
  useGrouping,
  value,
}: {
  readonly locale: string;
  readonly useGrouping: boolean;
  readonly value: BigNumber;
}) => {
  if (!useGrouping) {
    return value.toFixed().replace(".", getLocaleNumberSymbols(locale).decimal);
  }

  return formatNumber(value, locale);
};
