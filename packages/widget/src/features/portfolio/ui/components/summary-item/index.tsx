import type BigNumber from "bignumber.js";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  type SummaryLabelContainerVariants,
  summaryItem,
  summaryLabel,
  summaryLabelContainer,
  summaryNumber,
} from "./index.css";

export const SummaryItem = ({
  label,
  value,
  isLoading,
  type,
}: {
  label: string;
  value: BigNumber | undefined;
  isLoading: boolean;
  type: NonNullable<SummaryLabelContainerVariants>["type"];
}) => {
  const variant = useWidgetConfig("variant");

  const isApyType = type === "apy";
  const getFormattedValue = () => {
    if (!value?.gt(0)) return "-";
    return isApyType
      ? `${formatNumber(value, 2)}%`
      : `$${formatNumber(value, 3)}`;
  };
  const formattedValue = getFormattedValue();

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: summaryItem,
        variant,
      })}
    >
      {isLoading ? (
        <Spinner variant={{ size: "small" }} />
      ) : (
        <Text
          className={combineRecipeWithVariant({
            rec: summaryNumber,
            variant,
          })}
        >
          {formattedValue}
        </Text>
      )}

      <Box display="flex" alignItems="center" justifyContent="center" gap="1">
        <Box
          py="1"
          px="1"
          background="backgroundMuted"
          className={combineRecipeWithVariant({
            rec: summaryLabelContainer,
            variant,
            type,
          })}
        >
          <Text
            className={combineRecipeWithVariant({
              rec: summaryLabel,
              variant,
            })}
          >
            {label}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
