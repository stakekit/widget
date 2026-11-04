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
  /** The visible label; it names the control. */
  readonly label: string;
  /** Help under the control; it describes the control. */
  readonly description?: string;
  /** Shown in place of the description and marks the control invalid. */
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
  error,
  disabled = false,
  children,
}: FieldProps) => (
  <BaseField.Root
    invalid={error !== undefined}
    disabled={disabled}
    {...stylex.props(styles.root)}
  >
    <BaseField.Label {...stylex.props(styles.label)}>{label}</BaseField.Label>
    <FieldStateContext value={{ disabled, invalid: error !== undefined }}>
      {children}
    </FieldStateContext>
    {error === undefined ? (
      description !== undefined && (
        <BaseField.Description {...stylex.props(styles.help)}>
          {description}
        </BaseField.Description>
      )
    ) : (
      <BaseField.Error match {...stylex.props(styles.help, styles.error)}>
        {error}
      </BaseField.Error>
    )}
  </BaseField.Root>
);

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
});
