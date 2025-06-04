import { Box } from "@sk-widget/components/atoms/box";
import { Spinner } from "@sk-widget/components/atoms/spinner";
import { Text } from "@sk-widget/components/atoms/typography/text";
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
