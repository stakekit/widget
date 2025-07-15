import type { RefObject } from "react";
import { useEffect } from "react";
import { usePrevious } from "../../../hooks/use-previous";
import { useSettings } from "../../../providers/settings";
import { vars } from "../../../styles/theme/contract.css";
import { MaybeDocument } from "../../../utils/maybe-document";
import { MaybeWindow } from "../../../utils/maybe-window";
import { initialFontSizeVar } from "./styles.css";

export const useAutoResizeText = ({
  inputVal,
  inputRef,
  spanRef,
}: {
  inputVal: string;
  inputRef: RefObject<HTMLInputElement | null>;
  spanRef: RefObject<HTMLSpanElement | null>;
}) => {
  const prevVal = usePrevious(inputVal);

  const { disableResizingInputFontSize } = useSettings();

  useEffect(() => {
    if (
      !inputRef.current ||
      !spanRef.current ||
      !prevVal ||
      inputVal.length === prevVal.length ||
      disableResizingInputFontSize
    ) {
      return;
    }

    const newFontSize = scale({
      inputEl: inputRef.current,
      spanEl: spanRef.current,
    });

    inputRef.current.style.fontSize = `${newFontSize}px`;
    spanRef.current.style.fontSize = `${newFontSize}px`;
  }, [inputRef, inputVal, prevVal, spanRef, disableResizingInputFontSize]);
};

const scale = ({
  inputEl,
  spanEl,
}: {
  inputEl: HTMLInputElement;
  spanEl: HTMLSpanElement;
}) =>
  MaybeWindow.map((w) => {
    const currentInputWidth = inputEl.offsetWidth;

    const descendingFontSizes = getDescendingFontSizes(inputEl);

    let currentFontSize = Number.parseFloat(
      w.getComputedStyle(spanEl).fontSize
    );

    for (const fs of descendingFontSizes) {
      spanEl.style.fontSize = `${fs}px`;
      if (spanEl.offsetWidth < currentInputWidth) {
        currentFontSize = fs;
        break;
      }
    }

    return currentFontSize;
  }).extractNullable();

const convertRemToPixels = (rem: number) =>
  rem *
  Number.parseFloat(
    MaybeDocument.map(
      (doc) => getComputedStyle(doc.documentElement).fontSize
    ).orDefault("0")
  );

const getDescendingFontSizes = (el: HTMLElement) =>
  MaybeWindow.map((w) =>
    [
      initialFontSizeVar,
      vars.fontSize["2xl"],
      vars.fontSize.xl,
      vars.fontSize.lgx,
      vars.fontSize.lg,
    ].map((fs) =>
      convertRemToPixels(
        Number.parseFloat(
          w
            .getComputedStyle(el)
            .getPropertyValue(fs.replace(/(var\()|(\))/g, ""))
        )
      )
    )
  ).orDefault([]);
