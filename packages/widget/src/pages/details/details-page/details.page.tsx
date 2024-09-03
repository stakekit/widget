import { Box } from "@sk-widget/components";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import {
  Tabs,
  type TabsProps,
} from "@sk-widget/pages/details/details-page/components/tabs";
import { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { checkHasPendingClaimRewards } from "@sk-widget/pages/details/shared";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

export const TABS_MAP = {
  earn: "/",
  positions: "/positions",
  activity: "/activity",
};

export const Details = () => {
  const trackEvent = useTrackEvent();

  const { positionsData } = usePositions();

  const hasPendingRewards = useMemo(
    () =>
      positionsData.data.some((p) =>
        checkHasPendingClaimRewards(p.balancesWithAmount)
      ),
    [positionsData.data]
  );

  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState<
    "earn" | "positions" | "activity"
  >("earn");

  console.log("selectedTab", selectedTab);

  const onTabPress: TabsProps["onTabPress"] = (selected) => {
    console.log("selected", selected);
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    setSelectedTab(selected);
    navigate(TABS_MAP[selected]);
  };

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
            hasPendingRewards={hasPendingRewards}
          />
        </Box>

        <Box display="flex" flex={1} flexDirection="column">
          <Outlet />
        </Box>
      </Box>
    </motion.div>
  );
};
