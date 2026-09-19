import type { ReactNode } from "react";
import { exactZero } from "../../../../domain/finance/exact";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import { ContentLoaderLine } from "../../primitives/content-loader";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { MaxButton } from "../max-button";
import { NumberInput, type NumberInputProps } from "../number-input";
import * as inputStyles from "../number-input/styles.css";
import {
  amountTokenSection,
  minMaxContainer,
  priceTxt,
  selectTokenBalance,
} from "./styles.css";

type AmountTokenSectionProps = {
  readonly disabled?: boolean;
  readonly isInvalid?: boolean;
  /** Right-hand control: selected token chip, token picker, or small CTA. */
  readonly accessory: ReactNode;
  readonly balance?: ReactNode;
  readonly balanceError?: boolean;
  readonly onMaxClick?: (() => void) | null;
  readonly maxButtonProps?: Pick<BoxProps, "background">;
  readonly minMaxLabel?: string | null;
  readonly minMaxError?: boolean;
  readonly minMaxTextAlign?: BoxProps["textAlign"];
  readonly showMaxButton?: boolean;
  readonly state?: "default" | "danger";
  /** Stake/unstake token border vs muted action-card border. */
  readonly tone?: "stake" | "action";
  readonly marginTop?: BoxProps["marginTop"];
  readonly dataRk?: string;
  readonly header?: ReactNode;
  readonly children?: ReactNode;
} & (
  | {
      readonly loading: true;
      readonly value?: never;
      readonly onChange?: never;
      readonly formattedPrice?: never;
    }
  | {
      readonly loading?: false;
      readonly value: NumberInputProps["value"];
      readonly onChange: NumberInputProps["onChange"];
      readonly formattedPrice: ReactNode;
    }
);

const loadingAmount = exactZero();
const ignoreAmountChange = () => undefined;

export const AmountTokenSection = ({
  loading = false,
  value = loadingAmount,
  onChange = ignoreAmountChange,
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
  minMaxTextAlign = "right",
  showMaxButton = true,
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
      data-testid={dataRk}
      aria-busy={loading || undefined}
    >
      {header}

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box minWidth="0" display="flex" flex={1}>
          {loading ? (
            <Box className={inputStyles.container}>
              <Text
                className={inputStyles.numberInput}
                variant={{ weight: "normal" }}
              >
                <ContentLoaderLine widthPx="3ch" />
              </Text>
            </Box>
          ) : (
            <NumberInput
              shakeOnInvalid
              isInvalid={isInvalid}
              onChange={onChange}
              value={value}
              disabled={disabled}
            />
          )}
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
          style={
            minMaxTextAlign === "left"
              ? { justifyContent: "flex-start" }
              : undefined
          }
          data-rk="stake-token-section-min-max"
        >
          <Text
            flex={1}
            variant={{ type: minMaxError ? "danger" : "muted" }}
            textAlign={minMaxTextAlign}
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
            {loading || !formattedPrice ? (
              <ContentLoaderLine widthPx="5ch" />
            ) : (
              formattedPrice
            )}
          </Text>
        </Box>

        <Box
          flexGrow={1}
          display="flex"
          justifyContent={loading ? "flex-end" : "space-between"}
          alignItems="center"
        >
          {loading ? (
            <ContentLoaderLine widthPx="16ch" />
          ) : (
            <>
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

              {showMaxButton && onMaxClick ? (
                <MaxButton
                  onMaxClick={onMaxClick}
                  disabled={disabled}
                  {...maxButtonProps}
                />
              ) : null}
            </>
          )}
        </Box>
      </Box>

      {children}
    </Box>
  );
};
