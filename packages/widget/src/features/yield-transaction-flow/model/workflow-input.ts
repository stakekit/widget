import { Match } from "effect";

import { getActionInputToken } from "../../../domain/action/rules";
import { getConfidentialChainId } from "../../../domain/earn/confidential";
import {
  ConfidentialTransactionWorkflowInput,
  makeYieldTransactionWorkflowInput,
  type TransactionWorkflowInput,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type { YieldTransactionFlowIntake } from "./intake";
import type { YieldFlowExecutionSource, YieldFlowSession } from "./session";

const getYieldFlowInputToken = (intake: YieldTransactionFlowIntake) =>
  Match.value(intake).pipe(
    Match.tag("Enter", ({ selectedToken }) => selectedToken),
    Match.tag("Exit", ({ unstakeToken }) => unstakeToken),
    Match.tag("Manage", ({ interactedToken }) => interactedToken),
    Match.tag("YieldActionContinuation", ({ action, selectedYield }) =>
      getActionInputToken({ actionDto: action, yieldDto: selectedYield })
    ),
    Match.exhaustive
  );

/**
 * The workflow an Execution of `source` runs. A confidential one converts the
 * deposit's token first and resumes what the Session's Ledger recorded.
 */
export const getYieldFlowWorkflowInput = ({
  session: { intake, ledger },
  source,
}: {
  readonly session: YieldFlowSession;
  readonly source: YieldFlowExecutionSource;
}): TransactionWorkflowInput => {
  const facts = {
    inputToken: getYieldFlowInputToken(intake),
    providersDetails: intake.providersDetails,
    walletScope: intake.walletScope,
  };

  if (source._tag === "Action") {
    return makeYieldTransactionWorkflowInput({
      ...facts,
      action: source.action,
    });
  }
  const { preparation, prepared } = source;
  const chainId =
    preparation._tag === "Encrypt" && preparation.instant
      ? getConfidentialChainId(preparation.yieldDto)
      : null;
  return new ConfidentialTransactionWorkflowInput({
    ...facts,
    conversion: source.conversion,
    finalizeUnwrap: chainId === null ? null : { chainId },
    ledger,
    preparation,
    prepared,
    yieldId: preparation.command.yieldId,
  });
};
