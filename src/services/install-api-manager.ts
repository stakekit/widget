import { APIManager } from "@stakekit/api-hooks";
import { config } from "../config";
import { defaultQueryClientConfiguration } from "./query-client";

APIManager.configure({
  apiKey: "",
  baseURL: config.env.apiUrl,
  queryClientConfig: {
    defaultOptions: defaultQueryClientConfiguration as any,
  },
});
