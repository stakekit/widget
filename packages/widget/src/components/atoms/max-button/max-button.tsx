import { Box, type BoxProps, Text } from "@sk-widget/components";
import { pressAnimation } from "@sk-widget/components/atoms/button/styles.css";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

export type MaxButtonProps = PropsWithChildren<{
  onMaxClick: () => void;
}> &
  BoxProps;

export const MaxButton = ({ onMaxClick, ...rest }: MaxButtonProps) => {
  const { t } = useTranslation();

  return (
    <Box
      data-rk="stake-token-section-max-button"
      as="button"
      borderRadius="xl"
      background="background"
      px="2"
      py="1"
      marginLeft="2"
      onClick={onMaxClick}
      className={pressAnimation}
      {...rest}
    >
      <Text variant={{ weight: "semibold", type: "regular" }}>
        {t("shared.max")}
      </Text>
    </Box>
  );
};
