import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import { pressAnimation } from "../../primitives/button/styles.css";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { container, text } from "./styles.css";

type MaxButtonProps = PropsWithChildren<{
  onMaxClick: () => void;
}> &
  BoxProps;

export const MaxButton = ({
  onMaxClick,
  className,
  ...rest
}: MaxButtonProps) => {
  const { t } = useTranslation();

  const { variant } = useWidgetPresentation();

  return (
    <Box
      data-rk="stake-token-section-max-button"
      as="button"
      onClick={onMaxClick}
      className={clsx(
        pressAnimation,
        combineRecipeWithVariant({ rec: container, variant }),
        className
      )}
      {...rest}
    >
      <Text
        variant={{ type: "regular" }}
        className={combineRecipeWithVariant({ rec: text, variant })}
      >
        {t("shared.max")}
      </Text>
    </Box>
  );
};
