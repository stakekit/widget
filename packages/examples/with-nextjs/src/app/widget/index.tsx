"use-client";

import "@stakekit/widget/style.css";
import { config } from "@/config";
import { SKApp, darkTheme } from "@stakekit/widget";

export const Widget = () => {
  return <SKApp apiKey={config.apiKey} theme={darkTheme} />;
};
