import type { BoxProps } from "../box";
import { Box } from "../box";

type Props = BoxProps;

export const Divider = (props: Props) => {
  return (
    <Box height="px" width="full" background="backgroundMuted" {...props} />
  );
};
