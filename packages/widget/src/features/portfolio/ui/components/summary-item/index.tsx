import type BigNumber from "bignumber.js";
import { useWidgetConfig } from "../../../../../app/config";
import { formatNumber } from "../../../../../shared/lib";
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
          {value?.gt(0)
            ? isApyType
              ? `${formatNumber(value, 2)}%`
              : `$${formatNumber(value, 3)}`
            : "-"}
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
