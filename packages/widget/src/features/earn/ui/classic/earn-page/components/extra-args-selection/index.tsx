import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import { Divider } from "../../../../../../../shared/ui/components/divider";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { TronResourceSelection } from "../../../../../../yield-entry/views";
import { useEarnEntry } from "../../../../../react/use-earn-facades";

export const ExtraArgsSelection = () => {
  const { selectTronResource, view } = useEarnEntry();
  const { selectedStake, tronResource, validation } = view;

  const isDashboard = useWidgetConfig("dashboardVariant");

  return (
    <TronResourceSelection
      selectedYield={selectedStake}
      value={tronResource}
      isError={validation.submitted && validation.errors.tronResource}
      onSelect={selectTronResource}
    >
      {!isDashboard && (
        <Box marginTop="3">
          <Divider />
        </Box>
      )}
    </TronResourceSelection>
  );
};
