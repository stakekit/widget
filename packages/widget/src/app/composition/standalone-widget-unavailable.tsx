import { useState } from "react";
import { I18nextProvider } from "react-i18next";

import { WidgetUnavailable } from "../../features/widget-shell/composition";
import { variantHostProfiles } from "../../services/config/host-profile";
import type { RejectedConfigurationPresentation } from "../../services/config/widget-config-boundary";
import { createWidgetI18nInstance } from "../../services/translation/widget-translation";
import { LayoutAppContainer } from "../layouts/layout-app-container";
import { ThemeStyles } from "./providers/theme-wrapper";

/**
 * The widget-unavailable notice without the Application Runtime: rendered
 * instead of the widget when the initial Host Configuration was rejected, or
 * when rendering failed outside the route error boundary. The presentation is
 * decoded from the Host Configuration and the copy comes from a standalone
 * i18n instance in the browser's language.
 */
export const StandaloneWidgetUnavailable = ({
  presentation,
}: {
  readonly presentation: RejectedConfigurationPresentation;
}) => {
  const [i18n] = useState(createWidgetI18nInstance);
  const { appearance, layout, variant } = presentation;

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeStyles
        appearance={appearance}
        hostLook={variantHostProfiles[variant]}
        layout={layout}
        portalContainer={undefined}
      >
        <LayoutAppContainer layout={layout}>
          <WidgetUnavailable />
        </LayoutAppContainer>
      </ThemeStyles>
    </I18nextProvider>
  );
};
