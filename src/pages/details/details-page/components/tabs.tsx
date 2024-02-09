import { Box, Divider, Text } from "../../../../components";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import {
  activeTabBorder,
  divider,
  leftTabBorder,
  rewardsDot,
  rightTabBorder,
  tab,
  tabBorder,
  tabContainer,
} from "../styles.css";
import { motion } from "framer-motion";
import { useMountAnimation } from "../../../../providers/mount-animation";

export type TabsProps = {
  selectedTab: "earn" | "positions";
  onTabPress: (selected: "earn" | "positions") => void;
  hasPendingRewards: boolean;
};

export const Tabs = ({
  selectedTab,
  onTabPress,
  hasPendingRewards,
}: TabsProps) => {
  const { t } = useTranslation();

  const { state } = useMountAnimation();

  return (
    <motion.div
      initial={
        state.layout
          ? { opacity: 1, translateY: 0 }
          : { opacity: 0, translateY: "-40px" }
      }
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 1, delay: 0.5 }}
    >
      <Box position="relative" display="flex" justifyContent="center">
        <Box className={divider}>
          <Divider />
        </Box>

        <Box display="flex" alignItems="center" justifyContent="center">
          <Box className={tabContainer}>
            <Box
              className={clsx([pressAnimation, tab])}
              onClick={() => onTabPress("earn")}
            >
              <Text
                variant={{ type: selectedTab === "earn" ? "regular" : "muted" }}
              >
                {t("details.tab_earn")}
              </Text>
            </Box>

            <Box
              className={clsx([
                tabBorder,
                selectedTab === "earn" ? activeTabBorder : leftTabBorder,
              ])}
            />
          </Box>

          <Box className={tabContainer}>
            <Box
              className={clsx([pressAnimation, tab])}
              onClick={() => onTabPress("positions")}
            >
              <Box position="relative">
                <Text
                  variant={{
                    type: selectedTab === "positions" ? "regular" : "muted",
                  }}
                >
                  {t("details.tab_positions")}
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

            <Box
              className={clsx([
                tabBorder,
                selectedTab === "positions" ? activeTabBorder : rightTabBorder,
              ])}
            />
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};
