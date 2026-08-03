import BigNumber from "bignumber.js";

type LocaleNumberSymbols = {
  readonly decimal: string;
  readonly group: string;
};

const localeNumberSymbols = new Map<string, LocaleNumberSymbols>();

const getLocaleNumberSymbols = (locale: string): LocaleNumberSymbols => {
  const cached = localeNumberSymbols.get(locale);
  if (cached) return cached;

  const parts = new Intl.NumberFormat(locale).formatToParts(12_345.6);
  const symbols = {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
  };
  localeNumberSymbols.set(locale, symbols);
  return symbols;
};

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
  const parsed = new BigNumber(normalized);

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
  const { decimal, group } = getLocaleNumberSymbols(locale);

  if (!useGrouping) {
    return value.toFixed().replace(".", decimal);
  }

  return value.toFormat({
    decimalSeparator: decimal,
    groupSeparator: group,
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: "",
    fractionGroupSize: 0,
  });
};
