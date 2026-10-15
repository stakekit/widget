import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { Box } from "../../../../shared/ui/primitives/box";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { wrapper } from "../../dashboard/components/styles.css";
import { PoweredBy } from "../powered-by";
import { background, container, dashboardBackground } from "./style.css";

export const ShellNotice = ({
  description,
  testId,
  title,
}: {
  readonly description: string;
  readonly testId: string;
  readonly title: string;
}) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

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
      <PoweredBy opacity={1} />
    </Box>
  );
};
