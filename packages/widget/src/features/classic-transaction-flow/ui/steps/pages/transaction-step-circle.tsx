import type { PropsWithChildren } from "react";
import { Box } from "../../../../../shared/ui/primitives/box";

export const TransactionStepCircle = ({
  active,
  children,
}: PropsWithChildren<{ readonly active: boolean }>) => (
  <Box
    background={active ? "text" : "white"}
    borderColor={active ? "text" : "textMuted"}
    borderRadius="half"
    borderWidth={3}
    borderStyle="solid"
    hw="10"
    display="flex"
    alignItems="center"
    justifyContent="center"
    data-rk="tx-state-step-circle"
    data-state={active ? "success" : "pending"}
  >
    {children}
  </Box>
);
