import clsx from "clsx";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../components";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import { rewardsDot, tab, tabBorder, tabContainer } from "../styles.css";

type Props = {
  isSelected: boolean;
  onTabPress: () => void;
} & (
  | { variant: "earn"; hasPendingRewards?: never }
  | { variant: "positions"; hasPendingRewards: boolean }
  | { variant: "activity"; hasPendingRewards?: never }
);

export const Tab = ({
  isSelected,
  variant,
  hasPendingRewards,
  onTabPress,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box className={tabContainer}>
      <Box className={clsx([pressAnimation, tab])} onClick={onTabPress}>
        <Box
          {...(variant === "positions" && { position: "relative" })}
          display="inline-flex"
        >
          <Text
            data-state={isSelected ? "selected" : "default"}
            variant={{ type: isSelected ? "regular" : "muted" }}
          >
            {t(`details.tabs.${variant}`, variant)}
          </Text>

          {hasPendingRewards && (
            <Box
              borderRadius="full"
              width="1"
              height="1"
              background="positionsClaimRewardsBackground"
              className={rewardsDot}
            />
          )}
        </Box>
      </Box>

      {isSelected ? (
        <motion.div
          className={tabBorder}
          layoutId="underline"
          transition={{ duration: 0.15 }}
        />
      ) : null}
    </Box>
  );
};
