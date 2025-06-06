import { Box, type BoxProps } from "@sk-widget/components/atoms/box";
import { pressAnimation } from "@sk-widget/components/atoms/button/styles.css";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
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

  const { variant } = useSettings();

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
