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
const isAmountText = (text: string, separators: AmountSeparators) => {
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

/**
 * Typed text regrouped as the user edits it: group separators wherever they
 * were typed are dropped and the integer part is grouped in threes again,
 * while the decimal separator and the fraction stay exactly as typed.
 * `null` when the text, ungrouped, is no amount `isAmountText` accepts.
 */
export const regroupAmountText = (
  text: string,
  separators: AmountSeparators
): string | null => {
  const { integer, fraction } = splitAtDecimal(text, separators.decimal);
  const digits = [...integer]
    .filter((character) => !isGroup(character, separators.group))
    .join("");
  const ungrouped =
    fraction === undefined
      ? digits
      : `${digits}${separators.decimal}${fraction}`;
  if (!isAmountText(ungrouped, separators)) return null;

  const grouped = digits.replace(/\B(?=(\d{3})+$)/gu, separators.group);
  return fraction === undefined
    ? grouped
    : `${grouped}${separators.decimal}${fraction}`;
};

/**
 * Where the caret goes in `regrouped` text so that the same digits and
 * decimal separator stand before it as before `caret` in `typed`.
 */
export const regroupedCaret = (
  typed: string,
  caret: number,
  regrouped: string,
  separators: AmountSeparators
) => {
  const kept = [...typed.slice(0, caret)].filter(
    (character) => !isGroup(character, separators.group)
  ).length;
  if (kept === 0) return 0;

  const keptAt = [...regrouped].flatMap((character, index) =>
    isGroup(character, separators.group) ? [] : [index]
  );
  return (keptAt[kept - 1] ?? regrouped.length - 1) + 1;
};

/**
 * An amount's text with its last `count` fraction digits dropped, which
 * rounds it down; the decimal separator goes with the last of them.
 */
export const dropFractionDigits = (
  text: string,
  separators: AmountSeparators,
  count: number
) => {
  const { integer, fraction } = splitAtDecimal(text, separators.decimal);
  if (count <= 0 || fraction === undefined) return text;

  // An amount below one keeps its first non-zero digit, so it never reads 0.
  const significant = /[1-9]/u.test(integer)
    ? 0
    : fraction.search(/[1-9]/u) + 1;
  const kept = fraction.slice(
    0,
    Math.max(significant, fraction.length - count)
  );
  return kept === "" ? integer : `${integer}${separators.decimal}${kept}`;
};

/**
 * Whether inserted text reads as an amount in another language's decimal
 * separator: one group separator followed by only one or two digits and no
 * decimal separator, such as `123,45` in English. A space group separator is
 * no language's decimal separator, so it never does.
 */
export const isOtherDecimalSeparator = (
  text: string,
  separators: AmountSeparators
) => {
  if (spaceGroups[separators.group] === true) return false;
  if (text.includes(separators.decimal)) return false;

  const parts = text.split(separators.group);
  const [integer = "", fraction = ""] = parts;
  return (
    parts.length === 2 &&
    integer !== "" &&
    isDigits(integer) &&
    isDigits(fraction) &&
    fraction.length >= 1 &&
    fraction.length <= 2
  );
};

/**
 * Typed text after a forward delete that removed only a group separator, with
 * the digit after it removed too, as the delete meant; otherwise `typed`.
 * `caret` is where the delete left the caret.
 */
export const deleteForwardPastGroup = (
  previous: string,
  typed: string,
  caret: number,
  separators: AmountSeparators
) => {
  const removed = previous.slice(caret, caret + 1);
  const removedOnlyIt =
    `${previous.slice(0, caret)}${previous.slice(caret + 1)}` === typed;
  return removedOnlyIt && removed !== "" && isGroup(removed, separators.group)
    ? `${typed.slice(0, caret)}${typed.slice(caret + 1)}`
    : typed;
};
