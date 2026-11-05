import { StateMessage, type StateMessageProps } from "./state-message";

/**
 * What shows where a list or page has nothing yet, such as no positions or
 * no search results: a neutral spot, a title, a body and the primary action
 * that fills the space, such as "Start earning" or "Connect wallet".
 */
export const EmptyState = ({
  icon = "SearchIcon",
  ...rest
}: Omit<StateMessageProps, "tone" | "role">) => (
  <StateMessage {...rest} icon={icon} tone="neutral" />
);
