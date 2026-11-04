import { Outlet } from "react-router";
import { Stack } from "../../../../../ui/index";
import { DetailsTabs } from "./components/tabs";

/** The Compact Layout's tabbed pages: the tabs over the selected tab's page. */
export const Details = ({
  pendingActionsCount,
}: Readonly<{ readonly pendingActionsCount: number }>) => (
  <Stack grow gap={4}>
    <DetailsTabs pendingActionsCount={pendingActionsCount} />
    <Stack grow>
      <Outlet />
    </Stack>
  </Stack>
);
