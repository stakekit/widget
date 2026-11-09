import {
  getYieldFlowIntakeYield,
  type YieldTransactionFlowIntake,
} from "./intake";

/**
 * Who runs a flow's action, by name and logo: a validator's logo is a
 * rounded square, a provider's round.
 */
export type YieldFlowAttribution = Readonly<{
  readonly logo: string | undefined;
  readonly name: string;
  readonly shape: "round" | "square";
}>;

/**
 * Who runs a flow's action, as Review, Steps and Complete all name it: the
 * validators the user chose, else the yield's provider. Its logo is the
 * first chosen validator's that has one, else the provider's. Null when the
 * yield names no provider and no validator was chosen.
 */
export const getYieldFlowAttribution = (
  intake: YieldTransactionFlowIntake
): YieldFlowAttribution | null => {
  const chosen = intake.providersDetails.filter(({ name }) => name);
  if (chosen.length > 0) {
    return {
      logo: chosen.find(({ logo }) => logo)?.logo,
      name: chosen.map(({ name }) => name).join(", "),
      shape: "square",
    };
  }
  const provider = getYieldFlowIntakeYield(intake).provider;
  return provider?.name
    ? {
        logo: provider.logoURI ?? undefined,
        name: provider.name,
        shape: "round",
      }
    : null;
};
