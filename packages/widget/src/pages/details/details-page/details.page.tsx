import { Box } from "@sk-widget/components/atoms/box";
import { AnimatedTabs } from "@sk-widget/pages/details/details-page/components/tabs";
import { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Outlet } from "react-router";

export const Details = () => {
  const { positionsData } = usePositions();

  const pendingActionsCount = useMemo(
    () =>
      positionsData.data.reduce((acc, val) => {
        if (val.hasPendingClaimRewards || val.actionRequired) return acc + 1;

        return acc;
      }, 0),
    [positionsData.data]
  );

  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(8px)", scale: 0.8 }}
      transition={{ exit: { duration: 0.4 } }}
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
