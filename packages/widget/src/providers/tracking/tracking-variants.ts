import mixpanel from "mixpanel-browser";
import type { SettingsProps } from "../settings/types";

export const initMixpanel = (token: string) => mixpanel.init(token);

export const tracking: SettingsProps["tracking"] = {
  trackEvent: (...args) => {
    mixpanel.track(...args);
  },
  trackPageView: (page, props) => {
    mixpanel.track_pageview({ page, ...(props && { props }) });
  },
};
