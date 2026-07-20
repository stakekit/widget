import { makeClassicTransactionFlowIdentity } from "../../src/features/transaction-flow/model/classic-transaction-flow";

export const classicFlowIdentityFixture = (label: string) => {
  let hash = 2_166_136_261;
  for (const character of label) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  const suffix = (hash >>> 0).toString(16).padStart(8, "0").padEnd(12, "0");
  return makeClassicTransactionFlowIdentity(
    `00000000-0000-4000-8000-${suffix}`
  );
};
