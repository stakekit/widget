import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

/**
 * Shows `standIn`, such as a skeleton, in place of content that is still
 * settling. The content keeps rendering under it, hidden and inert, so it is
 * laid out and ready the moment the stand-in goes.
 */
export const StandIn = ({
  show,
  standIn,
  children,
  testIds,
}: {
  /** Whether the stand-in shows in place of the content. */
  readonly show: boolean;
  readonly standIn: ReactNode;
  readonly children: ReactNode;
  /** Render as the `data-testid` of the stand-in and of the content. */
  readonly testIds?: {
    readonly standIn?: string;
    readonly content?: string;
  };
}) => (
  <div {...stylex.props(styles.root)}>
    {show && (
      <div aria-hidden="true" inert data-testid={testIds?.standIn}>
        {standIn}
      </div>
    )}
    <div
      aria-hidden={show || undefined}
      inert={show || undefined}
      data-testid={testIds?.content}
      {...stylex.props(show && styles.concealed)}
    >
      {children}
    </div>
  </div>
);

const styles = stylex.create({
  root: { position: "relative" },
  concealed: {
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    visibility: "hidden",
    width: "100%",
  },
});
