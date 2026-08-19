import { motion } from "motion/react";
import { Outlet } from "react-router";
import { Box } from "../../../shared/ui/primitives/box";
import { AnimatedTabs } from "./components/tabs";

export const Details = ({
  pendingActionsCount,
}: Readonly<{ readonly pendingActionsCount: number }>) => {
  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(8px)", scale: 0.8 }}
      transition={{ duration: 0.4 }}
    >
      <Box flex={1} display="flex" flexDirection="column">
        <Box marginBottom="1">
          <AnimatedTabs pendingActionsCount={pendingActionsCount} />
        </Box>

        <Box display="flex" flex={1} flexDirection="column">
          <Outlet />
        </Box>
      </Box>
    </motion.div>
  );
};
