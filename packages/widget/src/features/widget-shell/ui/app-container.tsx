import type { PropsWithChildren } from "react";

import { type ShellFrameWidth, ShellFrameWidthContext } from "./shell-frame";

/**
 * The shell's root: sets how wide the shell's frame grows for everything it
 * renders, notices included.
 */
export const AppContainer = ({
  frameWidth,
  children,
}: PropsWithChildren<{ readonly frameWidth: ShellFrameWidth }>) => (
  <ShellFrameWidthContext value={frameWidth}>{children}</ShellFrameWidthContext>
);
