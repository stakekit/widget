import { Box } from "@sk-widget/components/atoms/box";
import { Spinner } from "@sk-widget/components/atoms/spinner";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { selectTokenTitle } from "@sk-widget/pages/details/earn-page/components/select-token-section/styles.css";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";

export const SelectTokenTitle = () => {
  const {
    appLoading,
    yieldType,
    selectTokenIsLoading,
    selectYieldIsLoading,
    selectValidatorIsLoading,
    footerIsLoading,
  } = useEarnPageContext();

  const isLoading =
    appLoading ||
    selectTokenIsLoading ||
    selectYieldIsLoading ||
    selectValidatorIsLoading ||
    footerIsLoading;

  const { variant } = useSettings();

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
