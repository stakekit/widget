export const DashboardYieldCategory = {
  RWA: "rwa",
  DeFi: "defi",
  Stake: "stake",
} as const;

export type DashboardYieldCategory =
  (typeof DashboardYieldCategory)[keyof typeof DashboardYieldCategory];
