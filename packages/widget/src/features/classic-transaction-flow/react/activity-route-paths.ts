export const historicalActivityCompletePaths = {
  stake: "stake-review/complete",
  unstake: "unstake-review/complete",
  pending: "pending-review/complete",
} as const;

export const toActivityRouteMatchPath = (
  path: (typeof historicalActivityCompletePaths)[keyof typeof historicalActivityCompletePaths]
) => `activity/${path}` as const;
