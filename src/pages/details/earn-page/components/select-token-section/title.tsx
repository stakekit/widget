import { Box, Spinner, Text } from "../../../../../components";
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

  return (
    <Box display="flex" alignItems="center" my="1">
      {isLoading ? (
        <Box display="flex">
          <Spinner />
        </Box>
      ) : (
        <Text>{yieldType}</Text>
      )}
    </Box>
  );
};
