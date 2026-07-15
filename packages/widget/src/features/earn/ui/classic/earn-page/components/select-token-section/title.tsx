import { useWidgetConfig } from "../../../../../../../app/config";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useEarnPageModel } from "../../state/earn-page-model";
import { selectTokenTitle } from "./styles.css";

export const SelectTokenTitle = () => {
  const {
    appLoading,
    yieldType,
    selectTokenIsLoading,
    selectYieldIsLoading,
    footerIsLoading,
  } = useEarnPageModel();

  const isLoading =
    appLoading ||
    selectTokenIsLoading ||
    selectYieldIsLoading ||
    footerIsLoading;

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
