import { Input } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import { useLayoutEffect, useRef, useState } from "react";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import {
  displayShrinkSize,
  font,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import {
  type AmountSeparators,
  isAmountText,
  toAmountText,
  toDecimalString,
} from "./amount-input-text";
import { focusRingStyles } from "./focus-ring";

const shake = stylex.keyframes({
  "0%": { transform: "rotate(0deg)" },
  "33%": { transform: "rotate(-1.5deg)" },
  "66%": { transform: "rotate(1.5deg)" },
  "100%": { transform: "rotate(0deg)" },
});

const steps = ["step0", "step1", "step2", "step3"] as const;
type Step = (typeof steps)[number];

/** What the user is typing, in the separators it was typed in. */
type Draft = { readonly text: string; readonly separators: AmountSeparators };

/** The text an amount is edited as: ungrouped, and empty for none or zero. */
const editText = (value: string, separators: AmountSeparators) =>
  value === "" || value === "0" ? "" : toAmountText(value, separators, false);

/**
 * The input's text: grouped while not focused; while focused, the draft, or
 * the amount again in new separators if the language changed meanwhile.
 */
const inputText = (
  draft: Draft | null,
  value: string,
  separators: AmountSeparators
) => {
  if (draft === null) return toAmountText(value, separators, true);
  if (
    draft.separators.decimal === separators.decimal &&
    draft.separators.group === separators.group
  ) {
    return draft.text;
  }
  return editText(value, separators);
};

type AmountInputProps = {
  /**
   * The amount as a decimal string (ASCII digits, at most one `.`), or `""`
   * for none. It is never read as a JavaScript `number`.
   */
  readonly value: string;
  /** Called with each amount typed, as a decimal string; `""` once cleared. */
  readonly onValueChange: (value: string) => void;
  /** The Widget language's separators, which typing and display use. */
  readonly separators: AmountSeparators;
  /** Names the input, unless a `Field` label does. */
  readonly label?: string;
  /** Marks the amount invalid: danger text, and a brief shake when it becomes so. */
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly onBlur?: () => void;
  /** Steps the type down as the amount fills the input. On by default. */
  readonly shrink?: boolean;
};

/**
 * The amount field, in the `display` type role with tabular figures. Typing
 * accepts only an amount in the Widget language's separators, and the value
 * stays exact: it goes in and out as a decimal string. While focused it shows
 * the amount ungrouped; otherwise grouped. As the amount fills the input its
 * type steps down 32 → 28 → 24 → 20.
 */
export const AmountInput = ({
  value,
  onValueChange,
  separators,
  label,
  invalid = false,
  disabled = false,
  onBlur,
  shrink = true,
}: AmountInputProps) => {
  // `null` while not focused, which shows `value`.
  const [draft, setDraft] = useState<Draft | null>(null);
  const text = inputText(draft, value, separators);
  const [step, setStep] = useState<Step>("step0");

  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // The largest step whose text fits the input. One hidden copy at the first
  // step is measured and scaled to the others; observing the copy and the
  // input measures again as the text changes and as the input resizes.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const copy = measureRef.current;
    if (!shrink || !input || !copy) return;

    const observer = new ResizeObserver(() => {
      const width = input.clientWidth;
      const textWidth = copy.offsetWidth;
      const baseSize = Number.parseFloat(displayShrinkSize.step0);
      // Text width scales with font size at a fixed family and weight.
      setStep(
        steps.find(
          (candidate) =>
            (textWidth * Number.parseFloat(displayShrinkSize[candidate])) /
              baseSize <=
            width
        ) ?? "step3"
      );
    });
    observer.observe(input);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [shrink]);

  const shownStep = shrink ? step : "step0";
  return (
    <div {...stylex.props(styles.root, invalid && styles.invalid)}>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={79}
        placeholder="0"
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (!isAmountText(next, separators)) return;

          setDraft({ text: next, separators });
          if (next === "") {
            onValueChange("");
            return;
          }
          const amount = toDecimalString(next, separators);
          if (amount !== null) onValueChange(amount);
        }}
        onFocus={() => {
          setDraft({ text: editText(value, separators), separators });
        }}
        onBlur={() => {
          setDraft(null);
          onBlur?.();
        }}
        {...stylex.props(
          styles.input,
          focusRingStyles.visible,
          stepStyles[shownStep]
        )}
      />
      {shrink && (
        <span
          aria-hidden="true"
          ref={measureRef}
          {...stylex.props(styles.measure, stepStyles.step0)}
        >
          {text === "" ? "0" : text}
        </span>
      )}
    </div>
  );
};

const styles = stylex.create({
  root: {
    display: "flex",
    flexGrow: 1,
    position: "relative",
    minWidth: 0,
  },
  // Respects reduced motion: the motion token's duration is then zero.
  invalid: {
    animationDuration: motion.fast,
    animationIterationCount: 3,
    animationName: shake,
    animationTimingFunction: motion.easing,
  },
  input: {
    margin: 0,
    padding: 0,
    borderRadius: radius.badge,
    borderStyle: "none",
    backgroundColor: "transparent",
    color: {
      default: color.text,
      ":is([aria-invalid])": color.danger,
      ":disabled": color.textMuted,
    },
    flexGrow: 1,
    fontFamily: font.sans,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.display,
    minWidth: 0,
    "::placeholder": { color: color.textMuted },
  },
  // An off-screen copy of the text at the first step, measured to pick one.
  measure: {
    fontFamily: font.sans,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    pointerEvents: "none",
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
    right: "100%",
  },
});

const stepStyles = stylex.create({
  step0: { fontSize: displayShrinkSize.step0 },
  step1: { fontSize: displayShrinkSize.step1 },
  step2: { fontSize: displayShrinkSize.step2 },
  step3: { fontSize: displayShrinkSize.step3 },
});
