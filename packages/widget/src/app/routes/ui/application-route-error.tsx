import { WidgetTranslationProvider } from "../../../features/preferences/composition";
import { WidgetUnavailable } from "../../../features/widget-shell/composition";
import { ThemeWrapper } from "../../composition/providers/theme-wrapper";

/**
 * Replaces the route element when rendering throws, so it renders outside
 * `Providers`. Only the atom registry above the router is available; the
 * translation and theme providers are re-mounted here from it.
 */
export const ApplicationRouteError = () => (
  <WidgetTranslationProvider>
    <ThemeWrapper>
      <WidgetUnavailable />
    </ThemeWrapper>
  </WidgetTranslationProvider>
);
