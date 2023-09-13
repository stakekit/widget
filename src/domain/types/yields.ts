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
  vault: { type: "vault", title: "Yearn", review: "Deposit" },
  lending: { type: "lending", title: "Lend", review: "Supply" },
} as const;
