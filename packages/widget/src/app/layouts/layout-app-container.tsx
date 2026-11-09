import type { PropsWithChildren } from "react";

import { AppContainer } from "../../features/widget-shell/composition";
import type { WidgetLayout } from "../../services/config/widget-config-model";

/**
 * How wide each Layout's frame grows: a single column in the Compact Layout,
 * a frame that lays out split views in the Dashboard Layout.
 */
const frameWidths = {
  Compact: "narrow",
  Dashboard: "wide",
} as const satisfies Record<WidgetLayout, "narrow" | "wide">;

/** The shell's app container presented for the given Layout. */
export const LayoutAppContainer = ({
  layout,
  children,
}: PropsWithChildren<{ readonly layout: WidgetLayout }>) => (
  <AppContainer frameWidth={frameWidths[layout]}>{children}</AppContainer>
);
