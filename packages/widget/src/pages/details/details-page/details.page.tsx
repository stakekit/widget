import { Box } from "@sk-widget/components";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import {
  Tabs,
  type TabsProps,
} from "@sk-widget/pages/details/details-page/components/tabs";
import { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { useSKLocation } from "@sk-widget/providers/location";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Outlet, useNavigate } from "react-router";

export const TABS_MAP = {
  earn: "/",
  positions: "/positions",
  activity: "/activity",
};

export const Details = () => {
  const trackEvent = useTrackEvent();

  const { positionsData } = usePositions();

  const pendingActionsCount = useMemo(
    () =>
      positionsData.data.reduce((acc, val) => {
        if (val.hasPendingClaimRewards || val.actionRequired) return acc + 1;

        return acc;
      }, 0),
    [positionsData.data]
  );

  const { current } = useSKLocation();

  const navigate = useNavigate();

  const onTabPress: TabsProps["onTabPress"] = (selected) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    navigate(TABS_MAP[selected]);
  };

  const selectedTab = current.pathname.startsWith("/positions")
    ? "positions"
    : current.pathname.startsWith("/activity")
      ? "activity"
      : "earn";

  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(8px)", scale: 0.8 }}
      transition={{ exit: { duration: 0.4 } }}
    >
      <Box flex={1} display="flex" flexDirection="column">
        <Box marginBottom="1">
          <Tabs
            onTabPress={onTabPress}
            selectedTab={selectedTab}
            pendingActionsCount={pendingActionsCount}
          />
        </Box>

        <Box display="flex" flex={1} flexDirection="column">
          <Outlet />
        </Box>
      </Box>
    </motion.div>
  );
};
