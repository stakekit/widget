import { YieldType } from "@stakekit/api-hooks";

export const yieldTypesMap: {
  [key in YieldType]: { type: key; title: string; review: string };
} = {
  staking: { type: "staking", title: "Stake", review: "Stake" },
  "liquid-staking": {
    type: "liquid-staking",
    title: "Liquid stake",
    review: "Liquid stake",
  },
  vault: { type: "vault", title: "Yield Vaults", review: "Deposit" },
  lending: { type: "lending", title: "Lend", review: "Supply" },
  restaking: { type: "restaking", title: "Restake", review: "Restake" },
} as const;

export const yieldTypesSortRank: { [Key in YieldType]: number } = {
  staking: 1,
  "liquid-staking": 2,
  vault: 3,
  lending: 4,
  restaking: 5,
};
