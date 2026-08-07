import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import { getYieldTypeLabels } from "../../../../../../../domain/types/yields";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  useEarnEntry,
  useEarnTokenSelection,
  useEarnYieldSelection,
} from "../../../../../react/use-earn-facades";
import { selectTokenTitle } from "./styles.css";

export const SelectTokenTitle = () => {
  const { t } = useTranslation();
  const { view: entry } = useEarnEntry();
  const { view: tokens } = useEarnTokenSelection();
  const { view: yields } = useEarnYieldSelection();

  const isLoading =
    entry.appLoading ||
    tokens.isLoading ||
    yields.isLoading ||
    entry.footerIsLoading;
  const yieldType = entry.selectedStake
    ? getYieldTypeLabels(entry.selectedStake, t).title
    : "";

  const variant = useWidgetConfig("variant");

  return (
    <Box display="flex" alignItems="center" my="1">
      {isLoading ? (
        <Box display="flex">
          <Spinner />
        </Box>
      ) : (
        <Text
          className={combineRecipeWithVariant({
            rec: selectTokenTitle,
            variant,
          })}
        >
          {yieldType}
        </Text>
      )}
    </Box>
  );
};
