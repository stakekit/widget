import { useDetailsContext } from "../../state/details-context";
import { Box, Spinner, Text } from "../../../../../components";
import { HelpModal } from "../../../../../index.package";

export const SelectTokenTitle = () => {
  const { appLoading, yieldType, selectedStakeYieldType } = useDetailsContext();

  return (
    <Box display="flex" alignItems="center" minHeight="8">
      {appLoading ? (
        <Box display="flex" marginLeft="2">
          <Spinner />
        </Box>
      ) : (
        <>
          <Text>{yieldType}</Text>
          {selectedStakeYieldType && (
            <HelpModal modal={{ type: selectedStakeYieldType }} />
          )}
        </>
      )}
    </Box>
  );
};
