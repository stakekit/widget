import {
  type ConfidentialPreparation,
  getConfidentialPreparation,
} from "../../../domain/earn/confidential-vault";
import type { YieldTransactionFlowIntake } from "./intake";

/**
 * How a confidential vault's Execution creates its action, once confirmed:
 * its amount encrypted, or its withdrawal decrypted. Null for other vaults
 * and for an Activity continuation, which resumes an action already created.
 */
export const getYieldFlowConfidentialPreparation = (
  intake: YieldTransactionFlowIntake
): ConfidentialPreparation | null => {
  switch (intake._tag) {
    case "Enter":
      return getConfidentialPreparation({
        command: intake.request,
        intent: "enter",
        token: intake.selectedToken,
        yieldDto: intake.selectedStake,
      });
    case "Exit":
      return getConfidentialPreparation({
        command: intake.request,
        intent: "exit",
        yieldDto: intake.integration,
      });
    case "Manage":
      return getConfidentialPreparation({
        command: intake.request,
        handle: intake.confidentialHandle ?? null,
        intent: "manage",
        yieldDto: intake.integration,
      });
    case "YieldActionContinuation":
      return null;
  }
};
