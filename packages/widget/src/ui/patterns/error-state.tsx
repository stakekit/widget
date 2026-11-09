import { StateMessage, type StateMessageProps } from "./state-message";

/**
 * What shows where a list or page failed to load, in place of that section
 * only: a danger spot, a title, a body and a secondary action, such as
 * "Try again". It is announced as soon as it shows.
 */
export const ErrorState = ({
  icon = "WarningIcon",
  ...rest
}: Omit<StateMessageProps, "tone" | "role">) => (
  <StateMessage {...rest} icon={icon} tone="danger" role="alert" />
);
