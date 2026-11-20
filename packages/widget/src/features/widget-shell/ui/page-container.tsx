import type { PropsWithChildren } from "react";

import { Stack } from "../../../ui/index";

/** A page's column, under the shell's header. */
export const PageContainer = ({
  children,
  testId,
}: PropsWithChildren<{ readonly testId?: string }>) => (
  <Stack hostHook="page-container" grow gap="gutter" testId={testId}>
    {children}
  </Stack>
);
