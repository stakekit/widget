import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import type { Token } from "../../../../domain/token/token";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../primitives/button/styles.css";
import { CaretDownIcon } from "../../primitives/icons/caret-down";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { TokenIcon } from "../token-icon";

const chipProps = {
  alignItems: "center",
  borderRadius: "2xl",
  display: "flex",
  gap: "2",
  justifyContent: "center",
  px: "2",
  py: "1",
} satisfies BoxProps;

/** Non-interactive selected-token chip shown beside amount inputs. */
export const SelectedToken = ({
  testId = "select-token",
  token,
}: {
  readonly testId?: string;
  readonly token: Token;
}) => {
  const { variant } = useWidgetPresentation();

  return (
    <Box
      {...chipProps}
      data-testid={testId}
      className={combineRecipeWithVariant({ rec: selectTokenButton, variant })}
    >
      <Box display="flex" alignItems="center">
        <TokenIcon token={token} />
        <Text variant={{ weight: "bold" }}>{token.symbol}</Text>
      </Box>
    </Box>
  );
};

/** Selected-token chip that opens the enclosing select modal. */
export const SelectTokenTrigger = ({
  testId,
  token,
}: {
  readonly testId: string;
  readonly token: Token;
}) => {
  const { variant } = useWidgetPresentation();

  return (
    <Trigger asChild>
      <Box
        {...chipProps}
        as="button"
        type="button"
        data-testid={testId}
        className={clsx(
          pressAnimation,
          combineRecipeWithVariant({ rec: selectTokenButton, variant })
        )}
      >
        <Box display="flex" alignItems="center">
          <TokenIcon token={token} />
          <Text variant={{ weight: "bold" }}>{token.symbol}</Text>
        </Box>
        <CaretDownIcon />
      </Box>
    </Trigger>
  );
};
