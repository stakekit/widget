import { useDetailsContext } from "../../state/details-context";
import { Box, Spinner, Text } from "../../../../../components";

export const SelectTokenTitle = () => {
  const {
    appLoading,
    yieldType,
    selectTokenIsLoading,
    selectYieldIsLoading,
    selectValidatorIsLoading,
    footerIsLoading,
  } = useDetailsContext();

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
