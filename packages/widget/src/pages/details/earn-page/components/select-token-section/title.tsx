import { Box } from "../../../../../components/atoms/box";
import { Spinner } from "../../../../../components/atoms/spinner";
import { Text } from "../../../../../components/atoms/typography/text";
import { useSettings } from "../../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";
import { selectTokenTitle } from "./styles.css";

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
