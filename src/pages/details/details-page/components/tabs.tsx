import { Box, Divider } from "../../../../components";
import { divider } from "../styles.css";
import { motion } from "framer-motion";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { Tab } from "./tab";

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

        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          data-rk="tabs-section"
        >
          <Tab
            isSelected={selectedTab === "earn"}
            onTabPress={() => onTabPress("earn")}
            variant="earn"
          />

          <Tab
            isSelected={selectedTab === "positions"}
            onTabPress={() => onTabPress("positions")}
            variant="positions"
            hasPendingRewards={hasPendingRewards}
          />
        </Box>
      </Box>
    </motion.div>
  );
};
