import { Divider } from "../../../../../ui/index";
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
      {showDivider && <Divider />}
    </TronResourceSelection>
  );
};
