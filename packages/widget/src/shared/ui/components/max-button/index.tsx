import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { combineRecipeWithVariant } from "../../../styles/recipe-variant";
import { Box, type BoxProps } from "../../primitives/box";
import { pressAnimation } from "../../primitives/button/styles.css";
import { ContentLoaderLine } from "../../primitives/content-loader";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import { container, text } from "./styles.css";

type MaxButtonProps = PropsWithChildren<{
  onMaxClick: () => void;
  loading?: boolean;
}> &
  BoxProps;

export const MaxButton = ({
  onMaxClick,
  className,
  loading = false,
  disabled,
  ...rest
}: MaxButtonProps) => {
  const { t } = useTranslation();

  const { variant } = useWidgetPresentation();
  const isDisabled = disabled || loading;

  return (
    <Box
      data-rk="stake-token-section-max-button"
      as="button"
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={isDisabled ? undefined : onMaxClick}
      className={clsx(
        !isDisabled && pressAnimation,
        combineRecipeWithVariant({ rec: container, variant }),
        className
      )}
      {...rest}
    >
      <Text
        variant={{ type: "regular" }}
        className={combineRecipeWithVariant({ rec: text, variant })}
      >
        {loading ? <ContentLoaderLine widthPx="3ch" /> : t("shared.max")}
      </Text>
    </Box>
  );
};
