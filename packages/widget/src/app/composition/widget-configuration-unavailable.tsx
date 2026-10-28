import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import {
  AppContainer,
  WidgetUnavailableWithoutConfiguration,
} from "../../features/widget-shell/composition";
import type { RejectedConfigurationPresentation } from "../../services/config/widget-config-boundary";
import { createWidgetI18nInstance } from "../../services/translation/widget-translation";
import { ThemeStyles } from "./providers/theme-wrapper";

/**
 * Rendered instead of the widget when the initial Host Configuration was
 * rejected. The Application Runtime never started, so the presentation is
 * decoded from the rejected configuration and the copy comes from a
 * standalone i18n instance in the browser's language.
 */
export const WidgetConfigurationUnavailable = ({
  presentation,
}: {
  readonly presentation: RejectedConfigurationPresentation;
}) => {
  const [i18n] = useState(createWidgetI18nInstance);
  const { layout, theme, variant } = presentation;

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeStyles theme={theme} variant={variant}>
        <AppContainer layout={layout}>
          <WidgetUnavailableWithoutConfiguration />
        </AppContainer>
      </ThemeStyles>
    </I18nextProvider>
  );
};
