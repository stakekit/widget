import { StateMessage, type StateMessageProps } from "./state-message";

/**
 * What shows where a list or page has nothing yet, such as no positions or
 * no search results: an icon, a title, a body and an action.
 */
export const EmptyState = ({
  icon = "SearchIcon",
  ...rest
}: Omit<StateMessageProps, "tone" | "role">) => (
  <StateMessage {...rest} icon={icon} tone="neutral" />
);
