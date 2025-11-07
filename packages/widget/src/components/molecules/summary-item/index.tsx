import { useSettings } from "../../../providers/settings";
import { formatNumber } from "../../../utils";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box } from "../../atoms/box";
import { Spinner } from "../../atoms/spinner";
import { Text } from "../../atoms/typography/text";
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
  const { variant } = useSettings();

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
