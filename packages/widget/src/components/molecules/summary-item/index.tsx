import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { Text } from "@sk-widget/components/atoms/typography/text";
import {
  type SummaryLabelContainerVariants,
  summaryItem,
  summaryLabel,
  summaryLabelContainer,
  summaryNumber,
} from "@sk-widget/components/molecules/summary-item/index.css";
import { useSettings } from "@sk-widget/providers/settings";
import { formatNumber } from "@sk-widget/utils";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";

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

  const content = isLoading ? (
    <Box width="full">
      <ContentLoaderSquare heightPx={40} variant={{ size: "medium" }} />
    </Box>
  ) : (
    <>
      {value && (
        <Text
          className={combineRecipeWithVariant({
            rec: summaryNumber,
            variant,
          })}
        >
          ${formatNumber(value, 2)}
        </Text>
      )}

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
    </>
  );

  return (
    <Box
      px="2"
      py="2"
      className={combineRecipeWithVariant({ rec: summaryItem, variant })}
      background="background"
    >
      {content}
    </Box>
  );
};
