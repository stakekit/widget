import { Text } from "@sk-widget/components/atoms/typography/text";
import type { Atoms } from "@sk-widget/styles/theme/atoms.css";
import { assignInlineVars } from "@vanilla-extract/dynamic";
import { getBackgroundColor } from "../../../utils";
import { Box } from "../box";
import type { TextVariants } from "../typography/styles.css";
import { defaultColor, fallbackContainer } from "./styles.css";

export const ImageFallback = ({
  name,
  tokenLogoHw,
  textVariant,
}: {
  name: string;
  tokenLogoHw?: Atoms["hw"];
  textVariant?: TextVariants;
}) => {
  return (
    <Box
      className={fallbackContainer}
      borderRadius="half"
      style={assignInlineVars({
        [defaultColor]: getBackgroundColor(name),
      })}
      hw={tokenLogoHw ?? "9"}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Text
        variant={
          textVariant ?? {
            size: "large",
            type: "white",
            weight: "bold",
          }
        }
      >
        {name.charAt(0).toUpperCase()}
      </Text>
    </Box>
  );
};
