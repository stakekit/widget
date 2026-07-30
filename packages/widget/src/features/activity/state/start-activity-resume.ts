import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";
import { startClassicTransactionFlowAtom } from "../../classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../wallet/state";
import {
  type ActivityActionItem,
  getActivityActionOpenTarget,
} from "../model/activity-action";

export type ActivityResumePresentation = "Classic" | "Dashboard";

type StartActivityResume = Readonly<{
  readonly item: ActivityActionItem;
  readonly presentation: ActivityResumePresentation;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
}>;

export const startActivityResumeAtom = appRuntime
  .fn((command: StartActivityResume, context) => {
    if (context(walletConnectionStateAtom).status !== "connected") {
      return WalletModal.use((modal) => modal.openConnect);
    }
    if (!command.item.yieldData) return Effect.void;
    const openTarget = getActivityActionOpenTarget(
      command.item.actionData.status
    );
    if (!openTarget) return Effect.void;

    return context.setResult(startClassicTransactionFlowAtom, {
      intake: {
        _tag: "ActivityResume",
        action: command.item.actionData,
        providersDetails: command.providersDetails,
        selectedValidators: command.item.validatorsData,
        selectedYield: command.item.yieldData,
        walletScope: command.item.walletScope,
      },
      mount: {
        _tag: "ActivityResume",
        presentation: command.presentation,
        target: openTarget,
      },
    });
  })
  .pipe(Atom.withLabel("startActivityResumeAtom"));
