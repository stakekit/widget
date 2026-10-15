import { XIcon, type XIconProps } from "./x-icon";

export const PlusIcon = (props: Omit<XIconProps, "rotation">) => (
  <XIcon {...props} rotation={45} />
);
