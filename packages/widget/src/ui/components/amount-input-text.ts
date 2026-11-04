/**
 * The text of an `AmountInput`, read and written exactly: as strings, never
 * through a JavaScript `number`, so no digit is lost (ADR 0006). An amount
 * leaves as a plain decimal string: ASCII digits and at most one `.`, such as
 * `"1234.5"`.
 */

/** The decimal and grouping separators of the Widget's language. */
export type AmountSeparators = {
  readonly decimal: string;
  readonly group: string;
};

const spaceGroups: Readonly<Record<string, true>> = {
  " ": true,
  "\u00A0": true,
  "\u202F": true,
};

const isDigits = (text: string) => /^\d*$/u.test(text);

/**
 * A language whose group separator is a space accepts any of the spaces
 * people type or paste for it.
 */
const isGroup = (character: string, group: string) =>
  character === group ||
  (spaceGroups[group] === true && spaceGroups[character] === true);

/**
 * Whether an integer part is typed correctly: plain digits, or groups of three
 * after a first group of one to three. Only zero itself starts with `0`.
 */
const isIntegerText = (text: string, group: string) => {
  // Each group separator becomes a line break, which no digit is.
  const parts = [...text]
    .map((character) => (isGroup(character, group) ? "\n" : character))
    .join("")
    .split("\n");

  const [first = "", ...rest] = parts;
  if (!isDigits(first) || (first.startsWith("0") && text !== "0")) {
    return false;
  }
  if (rest.length === 0) return true;

  return (
    first.length >= 1 &&
    first.length <= 3 &&
    rest.every((part) => part.length === 3 && isDigits(part))
  );
};

const splitAtDecimal = (text: string, decimal: string) => {
  const at = text.indexOf(decimal);
  return at === -1
    ? { integer: text, fraction: undefined }
    : {
        integer: text.slice(0, at),
        fraction: text.slice(at + decimal.length),
      };
};

/**
 * Whether `text` can stand in the input as typed so far: empty, or an amount
 * in the language's separators that may still end in its decimal separator.
 */
export const isAmountText = (text: string, separators: AmountSeparators) => {
  const { integer, fraction } = splitAtDecimal(text, separators.decimal);
  if (fraction !== undefined && !isDigits(fraction)) return false;
  if (integer === "") return true;
  return isIntegerText(integer, separators.group);
};

/**
 * The decimal string typed text stands for, or `null` while it holds no digit
 * yet (empty, or only a decimal separator). Expects text `isAmountText`
 * accepts.
 */
export const toDecimalString = (
  text: string,
  separators: AmountSeparators
): string | null => {
  if (!/\d/u.test(text)) return null;

  const { integer, fraction } = splitAtDecimal(text, separators.decimal);
  const digits = [...integer]
    .filter((character) => !isGroup(character, separators.group))
    .join("");
  const whole = digits === "" ? "0" : digits;

  return fraction ? `${whole}.${fraction}` : whole;
};

/**
 * Shows a decimal string in the language's separators, with the integer part
 * grouped in threes when `grouped`.
 */
export const toAmountText = (
  value: string,
  separators: AmountSeparators,
  grouped: boolean
) => {
  const { integer, fraction } = splitAtDecimal(value, ".");
  const shownInteger = grouped
    ? integer.replace(/\B(?=(\d{3})+$)/gu, separators.group)
    : integer;

  return fraction === undefined
    ? shownInteger
    : `${shownInteger}${separators.decimal}${fraction}`;
};
