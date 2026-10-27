import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { TronResourceSelection } from "../../../../yield-entry/views";
import { useEarnEntry } from "../../../react/use-earn-facades";

export const ExtraArgsSelection = ({
  showDivider,
}: {
  /** Close the resource selection with a divider. */
  readonly showDivider: boolean;
}) => {
  const { selectTronResource, view } = useEarnEntry();
  const { selectedStake, tronResource, validation } = view;

  return (
    <TronResourceSelection
      selectedYield={selectedStake}
      value={tronResource}
      isError={validation.submitted && validation.errors.tronResource}
      onSelect={selectTronResource}
    >
      {showDivider && (
        <Box marginTop="3">
          <Divider />
        </Box>
      )}
    </TronResourceSelection>
  );
};
