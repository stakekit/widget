import { Stack, Text } from "../../../../ui/index";
import { ShellFrame } from "../shell-frame";

type ShellNoticeContent = {
  readonly description: string;
  readonly testId: string;
  readonly title: string;
};

/**
 * A full-widget notice in the shell's frame. It renders without Widget
 * Configuration: the app container gives the frame its width.
 */
export const ShellNotice = ({
  description,
  testId,
  title,
}: ShellNoticeContent) => (
  <ShellFrame>
    <Stack testId={testId} align="center" justify="center" gap={16} grow>
      <Text variant="title" as="h2" align="center">
        {title}
      </Text>
      <Text as="p" tone="muted" align="center">
        {description}
      </Text>
    </Stack>
  </ShellFrame>
);
