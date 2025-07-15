import clsx from "clsx";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import { Text } from "../../../../components/atoms/typography/text";
import { useSettings } from "../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../utils/styles";
import { tab, tabBorder, tabContainer, tabText } from "./styles.css";

type Props = {
  isSelected: boolean;
  onTabPress: () => void;
  variant: "overview" | "rewards" | "activity";
};

export const Tab = ({ isSelected, variant, onTabPress }: Props) => {
  const { t } = useTranslation();

  const { variant: appVariant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: tabContainer,
        variant: appVariant,
      })}
    >
      <Box
        className={clsx([
          pressAnimation,
          combineRecipeWithVariant({
            rec: tab,
            variant: appVariant,
            state: isSelected ? "active" : undefined,
          }),
        ])}
        onClick={onTabPress}
      >
        <Text
          data-state={isSelected ? "selected" : "default"}
          variant={{ type: isSelected ? "regular" : "muted" }}
          className={combineRecipeWithVariant({
            rec: tabText,
            variant: appVariant,
          })}
        >
          {t(`dashboard.details.tabs.${variant}`, variant)}
        </Text>
      </Box>

      {isSelected && appVariant !== "utila" ? (
        <motion.div
          className={tabBorder}
          layoutId="underline"
          transition={{ duration: 0.15 }}
        />
      ) : null}
    </Box>
  );
};
