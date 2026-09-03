import type { ReactNode } from "react";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { MaxButton } from "../max-button";
import { NumberInput, type NumberInputProps } from "../number-input";
import {
  amountTokenSection,
  minMaxContainer,
  priceTxt,
  selectTokenBalance,
} from "./styles.css";

type AmountTokenSectionProps = {
  readonly value: NumberInputProps["value"];
  readonly onChange: NumberInputProps["onChange"];
  readonly disabled?: boolean;
  readonly isInvalid?: boolean;
  /** Right-hand control: selected token chip, token picker, or small CTA. */
  readonly accessory: ReactNode;
  readonly formattedPrice: string;
  readonly balance?: ReactNode;
  readonly balanceError?: boolean;
  readonly onMaxClick?: (() => void) | null;
  readonly maxButtonProps?: Pick<BoxProps, "background">;
  readonly minMaxLabel?: string | null;
  readonly minMaxError?: boolean;
  readonly state?: "default" | "danger";
  /** Stake/unstake token border vs muted action-card border. */
  readonly tone?: "stake" | "action";
  readonly marginTop?: BoxProps["marginTop"];
  readonly dataRk?: string;
  readonly header?: ReactNode;
  readonly children?: ReactNode;
};

export const AmountTokenSection = ({
  value,
  onChange,
  disabled,
  isInvalid,
  accessory,
  formattedPrice,
  balance,
  balanceError = false,
  onMaxClick,
  maxButtonProps,
  minMaxLabel,
  minMaxError = false,
  state = "default",
  tone = "stake",
  marginTop,
  dataRk = "stake-token-section",
  header,
  children,
}: AmountTokenSectionProps) => {
  const { variant } = useWidgetPresentation();

  const stakeToneProps: BoxProps =
    tone === "stake"
      ? {
          background: "stakeSectionBackground",
          borderStyle: "solid",
          borderWidth: 1,
          className: combineRecipeWithVariant({
            rec: amountTokenSection,
            variant,
            state,
          }),
        }
      : {
          background: "background",
          borderStyle: "solid",
          borderWidth: 1,
          borderColor: "backgroundMuted",
          borderRadius: "xl",
        };

  return (
    <Box
      {...stakeToneProps}
      marginTop={marginTop}
      py="4"
      px="4"
      data-rk={dataRk}
    >
      {header}

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box minWidth="0" display="flex" flex={1}>
          <NumberInput
            shakeOnInvalid
            isInvalid={isInvalid}
            onChange={onChange}
            value={value}
            disabled={disabled}
          />
        </Box>

        <Box display="flex" justifyContent="center" alignItems="center">
          {accessory}
        </Box>
      </Box>

      {minMaxLabel ? (
        <Box
          className={combineRecipeWithVariant({
            rec: minMaxContainer,
            variant,
          })}
          data-rk="stake-token-section-min-max"
        >
          <Text
            variant={{ type: minMaxError ? "danger" : "muted" }}
            textAlign="right"
          >
            {minMaxLabel}
          </Text>
        </Box>
      ) : null}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginTop="2"
        flexWrap="wrap"
        data-rk="stake-token-section-balance"
        gap="1"
      >
        <Box className={priceTxt} display="flex">
          <Text
            variant={{ type: "muted", weight: "normal" }}
            className={combineRecipeWithVariant({
              rec: selectTokenBalance,
              variant,
            })}
          >
            {formattedPrice}
          </Text>
        </Box>

        <Box
          flexGrow={1}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box display="flex">
            {balance ? (
              <Text
                variant={{
                  weight: "normal",
                  type: balanceError ? "danger" : "muted",
                }}
                data-state={balanceError ? "error" : "valid"}
                className={combineRecipeWithVariant({
                  rec: selectTokenBalance,
                  variant,
                })}
              >
                {balance}
              </Text>
            ) : null}
          </Box>

          {onMaxClick ? (
            <MaxButton onMaxClick={onMaxClick} {...maxButtonProps} />
          ) : null}
        </Box>
      </Box>

      {children}
    </Box>
  );
};
