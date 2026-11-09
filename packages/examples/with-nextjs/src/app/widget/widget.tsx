"use client";

import "@stakekit/widget/style.css";
import { SKApp } from "@stakekit/widget";
import { config } from "@/config";

export const Widget = () => {
  return <SKApp apiKey={config.apiKey} appearance={{ colorScheme: "dark" }} />;
};
