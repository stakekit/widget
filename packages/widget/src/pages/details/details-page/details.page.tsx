import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Box } from "../../../components/atoms/box";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useSKLocation } from "../../../providers/location";
import { usePositions } from "../positions-page/hooks/use-positions";
import { checkHasPendingClaimRewards } from "../shared";
import type { TabsProps } from "./components/tabs";
import { Tabs } from "./components/tabs";

export const Details = () => {
  const trackEvent = useTrackEvent();

  const { positionsData } = usePositions();

  const { current } = useSKLocation();

  const hasPendingRewards = useMemo(
    () =>
      positionsData.data.some((p) =>
        checkHasPendingClaimRewards(p.balancesWithAmount)
      ),
    [positionsData.data]
  );

  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState<"earn" | "positions">("earn");

  if (current.pathname === "/" && selectedTab === "positions") {
    setSelectedTab("earn");
  } else if (current.pathname === "/positions" && selectedTab === "earn") {
    setSelectedTab("positions");
  }

  const onTabPress: TabsProps["onTabPress"] = (selected) => {
    if (selectedTab === selected) return;

    trackEvent("tabClicked", { selected });

    selected === "earn" ? navigate("/") : navigate("/positions");
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
