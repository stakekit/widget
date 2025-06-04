import { Box } from "@sk-widget/components/atoms/box";
import { pressAnimation } from "@sk-widget/components/atoms/button/styles.css";
import { Text } from "@sk-widget/components/atoms/typography/text";
import {
  tab,
  tabBorder,
  tabContainer,
  tabText,
} from "@sk-widget/pages-dashboard/common/components/tabs/styles.css";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import clsx from "clsx";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

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
