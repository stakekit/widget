import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box, type BoxProps } from "../box";
import { pressAnimation } from "../button/styles.css";
import { Text } from "../typography/text";
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
