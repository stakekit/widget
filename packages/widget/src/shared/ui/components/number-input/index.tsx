import type BigNumber from "bignumber.js";
import { motion, useAnimation } from "motion/react";
import type { ChangeEvent } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { exactZero } from "../../../../domain/finance/exact";
import { Box } from "../../primitives/box";
import { useWidgetPresentation } from "../../widget-presentation";
import {
  formatLocalizedNumber,
  isLocalizedNumberInput,
  parseLocalizedNumberInput,
} from "./locale-number";
import { container, numberInput, spanStyle } from "./styles.css";
import { useAutoResizeText } from "./use-auto-resize-text";

export type NumberInputProps = {
  onChange: (value: BigNumber) => void;
  onBlur?: () => void;
  value: BigNumber;
  disabled?: boolean;
  isInvalid?: boolean;
  shakeOnInvalid?: boolean;
};

export const NumberInput = memo(
  ({
    onChange,
    value,
    disabled,
    onBlur,
    isInvalid,
    shakeOnInvalid,
  }: NumberInputProps) => {
    const { locale } = useWidgetPresentation();
    const [localState, setLocalState] = useState(() =>
      formatLocalizedNumber({ locale, useGrouping: true, value })
    );
    const [isFocused, setIsFocused] = useState(false);
    const previousLocaleRef = useRef(locale);

    useEffect(() => {
      const localeChanged = previousLocaleRef.current !== locale;
      previousLocaleRef.current = locale;
      if (isFocused && !localeChanged) return;

      setLocalState(
        formatLocalizedNumber({ locale, useGrouping: !isFocused, value })
      );
    }, [value, isFocused, locale]);

    const _onChange = (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      if (!isLocalizedNumberInput(val, locale)) return;

      setLocalState(val);

      if (!val) return onChange(exactZero());

      const parsed = parseLocalizedNumberInput(val, locale);

      if (!parsed) return;

      onChange(parsed);
    };

    const isZero = localState === "0" || localState === "";

    const inputRef = useRef<HTMLInputElement>(null);
    const spanRef = useRef<HTMLSpanElement>(null);

    useAutoResizeText({
      inputRef,
      spanRef,
      inputVal: localState,
    });

    const animate = useAnimation();

    useEffect(() => {
      if (!shakeOnInvalid || !isInvalid) return;

      animate.start("shake");
    }, [animate, isInvalid, shakeOnInvalid]);

    return (
      <motion.div
        animate={animate}
        variants={{
          shake: {
            rotate: [-1.5, 1.5, 0],
            transition: { repeat: 3, duration: 0.12, ease: "easeInOut" },
          },
        }}
        className={container}
      >
        <Box
          as="input"
          color={shakeOnInvalid && isInvalid ? "textDanger" : "text"}
          disabled={disabled}
          name="stake-amount"
          ref={inputRef}
          data-testid="number-input"
          type="text"
          inputMode="decimal"
          className={numberInput}
          value={localState}
          onChange={_onChange}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          minLength={1}
          maxLength={79}
          onBlur={() => {
            setIsFocused(false);
            if (isZero) setLocalState("0");
            onBlur?.();
          }}
          onFocus={() => {
            setIsFocused(true);
            setLocalState(
              isZero
                ? ""
                : formatLocalizedNumber({
                    locale,
                    useGrouping: false,
                    value,
                  })
            );
          }}
        />
        <span ref={spanRef} className={spanStyle}>
          {localState}
        </span>
      </motion.div>
    );
  }
);
