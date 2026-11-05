import { Input } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  deleteForwardPastGroup,
  dropFractionDigits,
  isOtherDecimalSeparator,
  regroupAmountText,
  regroupedCaret,
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

/**
 * The type step the text takes, and how many trailing fraction digits the
 * unfocused text drops when it does not fit even the last step.
 */
type Fit = { readonly step: Step; readonly droppedDigits: number };

/** What the user is typing, in the separators it was typed in. */
type Draft = { readonly text: string; readonly separators: AmountSeparators };

/** The text an amount is edited as: grouped, and empty for none or zero. */
const editText = (value: string, separators: AmountSeparators) =>
  value === "" || value === "0" ? "" : toAmountText(value, separators, true);

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
  /**
   * Marks the amount invalid: announced as such, with a brief shake when it
   * becomes so. The amount keeps its text color; the message that says why
   * carries the danger tone.
   */
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly onBlur?: () => void;
  /** Steps the type down as the amount fills the input. On by default. */
  readonly shrink?: boolean;
  /** Renders as the input's `data-testid`. */
  readonly testId?: string;
  /**
   * Each new value above zero focuses the input, such as when a prompt
   * elsewhere on the page asks for an amount. Zero never does.
   */
  readonly focusRequest?: number;
};

/**
 * The amount field, in the `display` type role with tabular figures. Typing
 * accepts only an amount in the Widget language's separators, refusing text
 * that reads as another language's decimal separator, and the value stays
 * exact: it goes in and out as a decimal string. The integer part stays
 * grouped while typing, the caret keeping its place among the digits. As the
 * amount fills the input its type steps down 32 → 28 → 24 → 20; an unfocused
 * amount that still does not fit, such as a full-precision Max, shows only as
 * many fraction digits as fit, rounded down but never to zero. The value is
 * unchanged and focusing shows it in full.
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
  testId,
  focusRequest = 0,
}: AmountInputProps) => {
  // `null` while not focused, which shows `value`.
  const [draft, setDraft] = useState<Draft | null>(null);
  const text = inputText(draft, value, separators);
  const [fit, setFit] = useState<Fit>({ step: "step0", droppedDigits: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const digitRef = useRef<HTMLSpanElement>(null);
  // Where the caret goes once regrouped text renders; `null` leaves it.
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  useLayoutEffect(() => {
    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;
    inputRef.current?.setSelectionRange(caret, caret);
  });

  // The largest step whose text fits the input. One hidden copy at the first
  // step is measured and scaled to the others; observing the copy and the
  // input measures again as the text changes and as the input resizes. Past
  // the last step, a hidden digit's width tells how many fraction digits to
  // drop; figures are tabular, so every digit is that wide.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const copy = measureRef.current;
    const digit = digitRef.current;
    if (!shrink || !input || !copy || !digit) return;

    const observer = new ResizeObserver(() => {
      const width = input.clientWidth;
      const textWidth = copy.offsetWidth;
      const baseSize = Number.parseFloat(displayShrinkSize.step0);
      // Text width scales with font size at a fixed family and weight.
      const scale = (candidate: Step) =>
        Number.parseFloat(displayShrinkSize[candidate]) / baseSize;
      const step = steps.find(
        (candidate) => textWidth * scale(candidate) <= width
      );
      const lastScale = scale("step3");
      setFit(
        step
          ? { step, droppedDigits: 0 }
          : {
              step: "step3",
              droppedDigits: Math.ceil(
                (textWidth * lastScale - width) /
                  (digit.offsetWidth * lastScale)
              ),
            }
      );
    });
    observer.observe(input);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [shrink]);

  const shownStep = shrink ? fit.step : "step0";
  const shownText =
    draft === null && shrink
      ? dropFractionDigits(text, separators, fit.droppedDigits)
      : text;

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
        data-testid={testId}
        disabled={disabled}
        value={shownText}
        onChange={(event) => {
          const { nativeEvent } = event;
          const inputType =
            nativeEvent instanceof InputEvent ? nativeEvent.inputType : "";
          const caret =
            event.currentTarget.selectionStart ??
            event.currentTarget.value.length;
          const typed =
            inputType === "deleteContentForward"
              ? deleteForwardPastGroup(
                  text,
                  event.currentTarget.value,
                  caret,
                  separators
                )
              : event.currentTarget.value;
          if (
            !inputType.startsWith("delete") &&
            isOtherDecimalSeparator(typed, separators)
          ) {
            return;
          }
          const next = regroupAmountText(typed, separators);
          if (next === null) return;

          caretRef.current = regroupedCaret(typed, caret, next, separators);
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
        <>
          <span
            aria-hidden="true"
            ref={measureRef}
            {...stylex.props(styles.measure, stepStyles.step0)}
          >
            {text === "" ? "0" : text}
          </span>
          <span
            aria-hidden="true"
            ref={digitRef}
            {...stylex.props(styles.measure, stepStyles.step0)}
          >
            0
          </span>
        </>
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
      // An invalid amount keeps its color: the field's error carries the tone.
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
