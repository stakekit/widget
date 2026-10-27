import type { ReactNode } from "react";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import {
  combineRecipeWithVariant,
  type WidgetVariant,
} from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { wrapper } from "../../dashboard/components/styles.css";
import { PoweredBy } from "../powered-by";
import { background, container, dashboardBackground } from "./style.css";

type ShellNoticeContent = {
  readonly description: string;
  readonly testId: string;
  readonly title: string;
};

/** The host layout a notice fills: the dashboard or the yield widget, per variant. */
export type ShellNoticeLayout = Readonly<{
  dashboardVariant: boolean;
  variant: WidgetVariant;
}>;

export const ShellNotice = (content: ShellNoticeContent) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  return (
    <ShellNoticeFrame
      {...content}
      footer={<PoweredBy opacity={1} />}
      layout={{ dashboardVariant, variant }}
    />
  );
};

/** A full-widget notice laid out from props, so it renders without Widget Configuration. */
export const ShellNoticeFrame = ({
  description,
  footer,
  layout: { dashboardVariant, variant },
  testId,
  title,
}: ShellNoticeContent & {
  readonly footer?: ReactNode;
  readonly layout: ShellNoticeLayout;
}) => {
  return (
    <Box
      style={{ borderRadius: "14px" }}
      className={
        dashboardVariant
          ? [
              combineRecipeWithVariant({ rec: wrapper, variant }),
              dashboardBackground,
            ]
          : background
      }
    >
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
