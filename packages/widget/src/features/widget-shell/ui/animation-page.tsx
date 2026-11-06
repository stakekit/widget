import type { PropsWithChildren } from "react";

import { Stack } from "../../../ui/index";

/**
 * A route page's root inside the route transition: a column that takes the
 * height the transition gives it.
 */
export const AnimationPage = ({ children }: PropsWithChildren) => (
  <Stack grow>{children}</Stack>
);
