export { YieldProviderId } from "../../generated/yield-provider-ids.js";

export const YieldCategory = {
  RWA: "rwa",
  DeFi: "defi",
  Stake: "stake",
} as const;

export type YieldCategory = (typeof YieldCategory)[keyof typeof YieldCategory];
