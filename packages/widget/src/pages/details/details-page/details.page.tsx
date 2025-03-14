import { Box } from "@sk-widget/components";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import {
  Tabs,
  type TabsProps,
} from "@sk-widget/pages/details/details-page/components/tabs";
import { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { useSKLocation } from "@sk-widget/providers/location";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
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

  const [selectedTab, setSelectedTab] = useState<
    "earn" | "positions" | "activity"
  >("earn");

  if (current.pathname === "/" && selectedTab === "positions") {
    setSelectedTab("earn");
  } else if (current.pathname === "/positions" && selectedTab === "earn") {
    setSelectedTab("positions");
  } else if (current.pathname === "/activity" && selectedTab === "earn") {
    setSelectedTab("activity");
  }

  const onTabPress: TabsProps["onTabPress"] = (selected) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    setSelectedTab(selected);
    navigate(TABS_MAP[selected]);
  };

  console.log({ selectedTab });

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
