import { YieldType } from "@stakekit/api-hooks";

export const yieldTypesMap: {
  [key in YieldType]: { type: key; title: string };
} = {
  staking: { type: "staking", title: "Stake" },
  "liquid-staking": { type: "liquid-staking", title: "Liquid stake" },
  vault: { type: "vault", title: "Yearn" },
  lending: { type: "lending", title: "Lend" },
} as const;
