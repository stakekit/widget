import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/transaction-workflow/transaction-workflow-model";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import { startClassicTransactionFlowAtom } from "../../classic-transaction-flow/index";
import { walletConnectionStateAtom } from "../../wallet/index";
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

type StartActivityResumeOutcome =
  | Readonly<{ readonly _tag: "ConnectWalletOpened" }>
  | Readonly<{ readonly _tag: "Rejected"; readonly reason: "RejectedOwner" }>
  | Readonly<{ readonly _tag: "Started" }>
  | Readonly<{ readonly _tag: "Unavailable" }>;

export const startActivityResumeAtom = appRuntime
  .fn((command: StartActivityResume, context) => {
    if (context(walletConnectionStateAtom).status !== "connected") {
      return WalletModal.use((modal) => modal.openConnect).pipe(
        Effect.as<StartActivityResumeOutcome>({
          _tag: "ConnectWalletOpened",
        })
      );
    }
    if (!command.item.yieldData) {
      return Effect.succeed<StartActivityResumeOutcome>({
        _tag: "Unavailable",
      });
    }
    const openTarget = getActivityActionOpenTarget(
      command.item.actionData.status
    );
    if (!openTarget) {
      return Effect.succeed<StartActivityResumeOutcome>({
        _tag: "Unavailable",
      });
    }

    return context
      .setResult(startClassicTransactionFlowAtom, {
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
      })
      .pipe(
        Effect.map(
          (outcome): StartActivityResumeOutcome =>
            outcome._tag === "Started"
              ? { _tag: "Started" }
              : { _tag: "Rejected", reason: outcome._tag }
        )
      );
  })
  .pipe(Atom.withLabel("startActivityResumeAtom"));
