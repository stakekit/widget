import { Field as BaseField } from "@base-ui/react/field";
import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, use } from "react";
import { color } from "../tokens/color.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

type FieldProps = {
  /**
   * The label; it names the control. Without one, the control names itself,
   * such as where a visible title outside the field already reads as its
   * name.
   */
  readonly label?: string;
  /** Help under the control; it describes the control. */
  readonly description?: string;
  /**
   * Sets the description at the end of the line under the control, kept
   * beside any error instead of giving way to it, such as an amount's
   * limits, which stay in view while a balance error shows.
   */
  readonly descriptionAtEnd?: boolean;
  /** The description itself says what is wrong, such as a missed minimum. */
  readonly descriptionInvalid?: boolean;
  /** Shown under the control and marks it invalid. */
  readonly error?: string;
  readonly disabled?: boolean;
  /** One input, such as a `SearchInput` or `AmountInput`. */
  readonly children: ReactNode;
};

type FieldState = { readonly disabled: boolean; readonly invalid: boolean };

const FieldStateContext = createContext<FieldState>({
  disabled: false,
  invalid: false,
});

/**
 * The state of the enclosing `Field`, for an input's parts Base UI does not
 * reach, such as SearchInput's clear button. Outside a `Field`, neither.
 */
export const useFieldState = () => use(FieldStateContext);

/**
 * A labelled input: the label above it names it, the description or error
 * under it describes it, and an error marks it invalid.
 */
export const Field = ({
  label,
  description,
  descriptionAtEnd = false,
  descriptionInvalid = false,
  error,
  disabled = false,
  children,
}: FieldProps) => {
  const invalid = error !== undefined || descriptionInvalid;
  const descriptionPart = description !== undefined && (
    <BaseField.Description
      {...stylex.props(
        styles.help,
        descriptionInvalid && styles.error,
        descriptionAtEnd && styles.end
      )}
    >
      {description}
    </BaseField.Description>
  );
  const errorPart = error !== undefined && (
    <BaseField.Error match {...stylex.props(styles.help, styles.error)}>
      {error}
    </BaseField.Error>
  );

  return (
    <BaseField.Root
      invalid={invalid}
      disabled={disabled}
      {...stylex.props(styles.root)}
    >
      {label !== undefined && (
        <BaseField.Label {...stylex.props(styles.label)}>
          {label}
        </BaseField.Label>
      )}
      <FieldStateContext value={{ disabled, invalid }}>
        {children}
      </FieldStateContext>
      {descriptionAtEnd
        ? (errorPart || descriptionPart) && (
            <div {...stylex.props(styles.helpRow)}>
              {errorPart}
              {descriptionPart}
            </div>
          )
        : errorPart || descriptionPart}
    </BaseField.Root>
  );
};

const styles = stylex.create({
  root: {
    gap: space[6],
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    minWidth: 0,
  },
  label: {
    color: { default: color.text, ":is([data-disabled])": color.textMuted },
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
  },
  help: {
    margin: 0,
    color: color.textMuted,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
  },
  error: { color: color.danger },
  helpRow: {
    gap: space[8],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  end: { marginInlineStart: "auto", textAlign: "end" },
});
