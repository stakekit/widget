import {
  getConfidentialAssetToken,
  getConfidentialChainId,
  getConfidentialConversion,
  isConfidentialInstantExit,
  isConfidentialYield,
} from "../../../domain/earn/confidential";
import { toBaseUnits } from "../../../domain/finance/base-units";
import { exactDecimal } from "../../../domain/finance/exact";
import type { ConfidentialPreparation } from "../../../services/zama/confidential-preparation";
import type { YieldTransactionFlowIntake } from "./intake";
import type { PlannedStepType } from "./yield-transaction-workflow";

/**
 * How a confidential vault's Execution creates its action, once confirmed:
 * its amount encrypted, or its withdrawal decrypted. Null for other vaults.
 */
export const getYieldFlowConfidentialPreparation = (
  intake: YieldTransactionFlowIntake
): ConfidentialPreparation | null => {
  switch (intake._tag) {
    case "Enter": {
      const asset = getConfidentialAssetToken(intake.selectedStake);
      const amount = intake.request.arguments?.amount;
      if (!asset?.address || amount === undefined) return null;
      const conversion = getConfidentialConversion(
        intake.selectedStake,
        intake.selectedToken
      );
      const chainId = getConfidentialChainId(intake.selectedStake);
      return {
        _tag: "Encrypt",
        amount: toBaseUnits(
          exactDecimal(amount),
          intake.selectedToken.decimals,
          "truncate"
        ),
        assetAddress: asset.address,
        // A hidden balance is checked only once confirmed, not on the form.
        balance:
          conversion || chainId === null
            ? null
            : { chainId, token: intake.selectedToken },
        conversion,
        instant: false,
        command: intake.request,
        intent: "enter",
        requiresPermitSigner: true,
        yieldDto: intake.selectedStake,
      };
    }
    case "Exit": {
      const shares = intake.request.arguments?.shareAmountRaw;
      if (!isConfidentialYield(intake.integration) || shares === undefined) {
        return null;
      }
      return {
        _tag: "Encrypt",
        amount: BigInt(shares),
        assetAddress: null,
        balance: null,
        conversion: null,
        instant: isConfidentialInstantExit(
          intake.integration,
          intake.request.arguments?.outputToken
        ),
        command: intake.request,
        intent: "exit",
        requiresPermitSigner: false,
        yieldDto: intake.integration,
      };
    }
    case "Manage": {
      const chainId = getConfidentialChainId(intake.integration);
      return intake.confidentialHandle && chainId !== null
        ? {
            _tag: "Decrypt",
            chainId,
            handle: intake.confidentialHandle,
            command: intake.request,
          }
        : null;
    }
    case "YieldActionContinuation":
      return null;
  }
};

/**
 * The Planned Steps of a confidential flow: what it prepares only after
 * encrypting or decrypting its amount, listed until the API returns them. A
 * private exit first grants the router on each share token not yet granted;
 * an instant exit then finalizes its unwrap in the same flow.
 */
export const getYieldFlowPlannedStepTypes = (
  intake: YieldTransactionFlowIntake,
  { missingOperatorGrants }: { readonly missingOperatorGrants: number }
): ReadonlyArray<PlannedStepType> => {
  switch (intake._tag) {
    case "Enter":
      return ["DEPOSIT"];
    case "Exit":
      return isConfidentialInstantExit(
        intake.integration,
        intake.request.arguments?.outputToken
      )
        ? ["UNWRAP", "DECRYPT", "WITHDRAW", "REDEEM"]
        : [
            ...Array.from(
              { length: missingOperatorGrants },
              () => "SET_OPERATOR" as const
            ),
            "REDEEM",
          ];
    // Only a WITHDRAW pending action carries a handle to decrypt; it
    // finalizes the unwrap, then redeems the vault shares.
    case "Manage":
      return ["WITHDRAW", "REDEEM"];
    case "YieldActionContinuation":
      return [];
  }
};
