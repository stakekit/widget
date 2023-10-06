import { Box } from "../../../components/atoms/box";
import { Divider } from "../../../components/atoms/divider";
import { Tabs, TabsProps } from "./components/tabs";
import { Location, Outlet, useNavigate } from "react-router-dom";
import { useLocationTransition } from "../../../providers/location-transition";
import { useMemo, useState } from "react";
import { usePositions } from "../positions-page/hooks/use-positions";

export const Details = () => {
  const { location, transitionClassName, onAnimationEnd } =
    useLocationTransition();

  const { positionsData } = usePositions();

  const hasPendingRewards = useMemo(
    () =>
      positionsData.data.some((p) =>
        p.balances.some((b) => b.type === "rewards")
      ),
    [positionsData.data]
  );

  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState<"earn" | "positions">("earn");

  if (location.pathname === "/" && selectedTab === "positions") {
    setSelectedTab("earn");
  } else if (location.pathname === "/positions" && selectedTab === "earn") {
    setSelectedTab("positions");
  }

  const onTabPress: TabsProps["onTabPress"] = (selected) => {
    if (selectedTab === selected) return;

    selected === "earn" ? navigate("/") : navigate("/positions");
  };

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Box marginBottom="1">
        <Tabs
          onTabPress={onTabPress}
          selectedTab={selectedTab}
          hasPendingRewards={hasPendingRewards}
        />
      </Box>

      <Divider />

      <Box
        display="flex"
        flex={1}
        flexDirection="column"
        className={shouldAnimate(location) && transitionClassName}
        onAnimationEnd={onAnimationEnd}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

const shouldAnimate = (nextLocation: Location) =>
  nextLocation.pathname === "/" || nextLocation.pathname === "/positions";
