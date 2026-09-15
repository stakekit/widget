import type { Token } from "../../../../domain/token/token";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box } from "../../primitives/box";
import { selectTokenButton } from "../../primitives/button/styles.css";
import { ContentLoaderLine } from "../../primitives/content-loader";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { TokenIcon, TokenIconSkeleton } from "../token-icon";

/** Non-interactive selected-token chip shown beside amount inputs. */
export const SelectedToken = ({
  loading,
  token,
}:
  | { readonly loading: true; readonly token?: never }
  | {
      readonly loading?: false;
      readonly token: Token;
    }) => {
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
      {loading ? <TokenIconSkeleton /> : <TokenIcon token={token} />}
      <Text variant={{ weight: "bold" }}>
        {loading ? <ContentLoaderLine widthPx="4ch" /> : token.symbol}
      </Text>
    </Box>
  );
};
