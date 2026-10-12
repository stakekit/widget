import mixpanel from "mixpanel-browser";
import type { SKTrackingConfig } from "../../public-api/types";

export const initMixpanel = (token: string) => mixpanel.init(token);

export const tracking: SKTrackingConfig = {
  trackEvent: (...args) => {
    mixpanel.track(...args);
  },
  trackPageView: (page, props) => {
    mixpanel.track_pageview({ page, ...(props && { props }) });
  },
};
