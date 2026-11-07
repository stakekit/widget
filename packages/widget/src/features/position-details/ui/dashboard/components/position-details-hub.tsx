import { PositionDetailsActions } from "../../components/position-details-actions";
import { PositionDetailsEnterActions } from "./position-details-enter-actions";

/**
 * The position's actions in the Dashboard: exiting it or entering it
 * further, then its one-click actions.
 */
export const PositionDetailsHub = () => (
  <PositionDetailsActions
    renderEnter={(ctaVariant) => (
      <PositionDetailsEnterActions ctaVariant={ctaVariant} />
    )}
  />
);
