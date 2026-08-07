import type { AppToken } from "../../../../domain/schema/legacy-models";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box } from "../../primitives/box";
import { selectTokenButton } from "../../primitives/button/styles.css";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { TokenIcon } from "../token-icon";

/** Non-interactive selected-token chip shown beside amount inputs. */
export const SelectedToken = ({ token }: { readonly token: AppToken }) => {
  const { variant } = useWidgetPresentation();

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      borderRadius="2xl"
      px="2"
      py="1"
      gap="2"
      data-testid="select-token"
      className={combineRecipeWithVariant({
        variant,
        rec: selectTokenButton,
      })}
    >
      <TokenIcon token={token} />
      <Text variant={{ weight: "bold" }}>{token.symbol}</Text>
    </Box>
  );
};
