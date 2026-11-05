import type { ComponentProps } from "react";
import { EmptyState, ErrorState } from "../../../../ui/index";
import { ShellFrame } from "../shell-frame";

type StateProps = ComponentProps<typeof EmptyState>;

type ShellNoticeContent = {
  readonly description: string;
  readonly icon: NonNullable<StateProps["icon"]>;
  readonly testId: string;
  readonly title: string;
  /** What the user can do about it, such as switching network. */
  readonly action?: StateProps["action"];
  /** A failure, announced and drawn in the danger tone. */
  readonly failure?: boolean;
};

/**
 * A full-widget notice in the shell's frame: a spot, a title, what happened
 * and, when the user can resolve it, an action, centered in the frame. It
 * renders without Widget Configuration: the app container gives the frame
 * its width.
 */
export const ShellNotice = ({
  action,
  description,
  failure = false,
  icon,
  testId,
  title,
}: ShellNoticeContent) => {
  const State = failure ? ErrorState : EmptyState;

  return (
    <ShellFrame>
      <State
        testId={testId}
        size="lg"
        fill
        as="h2"
        icon={icon}
        title={title}
        body={description}
        {...(action === undefined ? {} : { action })}
      />
    </ShellFrame>
  );
};
