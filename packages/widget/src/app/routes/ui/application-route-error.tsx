import { useRevalidator } from "react-router";
import { WidgetTranslationProvider } from "../../../features/preferences/composition";
import { WidgetUnavailable } from "../../../features/widget-shell/composition";
import { ThemeWrapper } from "../../composition/providers/theme-wrapper";

/**
 * Replaces the route element when rendering throws, so it renders outside
 * `Providers`. Only the atom registry above the router is available; the
 * translation and theme providers are re-mounted here from it. "Try again"
 * revalidates the routes, which clears the route's render error and renders
 * it again.
 */
export const ApplicationRouteError = () => {
  const revalidator = useRevalidator();

  return (
    <WidgetTranslationProvider>
      <ThemeWrapper>
        <WidgetUnavailable onRetry={() => void revalidator.revalidate()} />
      </ThemeWrapper>
    </WidgetTranslationProvider>
  );
};
