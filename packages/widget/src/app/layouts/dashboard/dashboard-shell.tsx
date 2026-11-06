import type { ReactNode } from "react";

import type { YieldCategory } from "../../../domain/earn/contract";
import {
  DashboardHeader,
  ShellFrame,
} from "../../../features/widget-shell/composition";
import { DashboardTabs } from "./dashboard-tabs";

/**
 * The Dashboard Layout's frame: the tabs with the wallet controls at the end
 * of their row, over the page. Where both do not fit, the controls wrap under
 * the tabs.
 */
export const DashboardShell = ({
  children,
  pendingYieldCategory,
}: {
  readonly children: ReactNode;
  readonly pendingYieldCategory: YieldCategory | null;
}) => (
  <ShellFrame
    header={
      <DashboardTabs
        pendingYieldCategory={pendingYieldCategory}
        trailing={<DashboardHeader />}
      />
    }
  >
    {children}
  </ShellFrame>
);
