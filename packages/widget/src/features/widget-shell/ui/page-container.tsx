import type { PropsWithChildren } from "react";

import { Stack } from "../../../ui/index";
import { BackButton } from "./back-button";

/** A page's column under the shell's back button. */
export const PageContainer = ({
  children,
  testId,
}: PropsWithChildren<{ readonly testId?: string }>) => (
  <Stack hostHook="page-container" grow gap="gutter" testId={testId}>
    <BackButton />
    {children}
  </Stack>
);
