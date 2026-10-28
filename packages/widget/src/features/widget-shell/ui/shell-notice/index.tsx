import type { ReactNode } from "react";
import { Box } from "../../../../shared/ui/primitives/box";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { PoweredBy } from "../powered-by";
import { container, frame } from "./style.css";

type ShellNoticeContent = {
  readonly description: string;
  readonly testId: string;
  readonly title: string;
};

export const ShellNotice = (content: ShellNoticeContent) => (
  <ShellNoticeFrame {...content} footer={<PoweredBy opacity={1} />} />
);

/**
 * A full-widget notice that renders without Widget Configuration; the Layout
 * attribute on the app container frames it.
 */
export const ShellNoticeFrame = ({
  description,
  footer,
  testId,
  title,
}: ShellNoticeContent & {
  readonly footer?: ReactNode;
}) => {
  return (
    <Box className={frame}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={container}
        data-testid={testId}
      >
        <Box>
          <Heading
            marginBottom="4"
            textAlign="center"
            variant={{ level: "h4" }}
          >
            {title}
          </Heading>

          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
            marginBottom="4"
          >
            {description}
          </Text>
        </Box>
      </Box>
      {footer}
    </Box>
  );
};
