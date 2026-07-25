import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { runWidgetNavigationCommand } from "../../../app/runtime/navigation";
import type { YieldAction } from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import { ActionStatus } from "../../../domain/types/action";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";
import {
  classicFlowSessionStore,
  makeClassicTransactionFlowDestination,
} from "../../classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../wallet/state";

type ResumeActivityAction = Readonly<{
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly selectionMode: "navigate" | "select";
  readonly validators: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yield: EarnYieldWithProvider | null;
}>;

const getActivityFlowPathSegment = (type: YieldAction["type"]) => {
  switch (type) {
    case "UNSTAKE":
      return "unstake";
    case "STAKE":
      return "stake";
    default:
      return "pending";
  }
};

export const resumeActivityActionAtom = appRuntime
  .fn((command: ResumeActivityAction, context) => {
    if (context(walletConnectionStateAtom).status !== "connected") {
      return WalletModal.use((modal) => modal.openConnect);
    }
    if (!command.yield) return Effect.void;

    const segment = getActivityFlowPathSegment(command.action.type);
    const destination = makeClassicTransactionFlowDestination({
      completePath: `/activity/${segment}/complete`,
      routeBase: "/activity",
      stepsPath: `/activity/${segment}/steps`,
    });
    context.set(classicFlowSessionStore.startAtom, {
      destination,
      intake: {
        _tag: "ActivityResume",
        action: command.action,
        providersDetails: command.providersDetails,
        selectedValidators: command.validators,
        selectedYield: command.yield,
        walletScope: command.walletScope,
      },
    });

    if (command.selectionMode === "select") return Effect.void;

    if (
      command.action.status === ActionStatus.SUCCESS ||
      command.action.status === ActionStatus.PROCESSING
    ) {
      const urls = command.action.transactions.flatMap((transaction) =>
        transaction.explorerUrl
          ? [{ type: transaction.type, url: transaction.explorerUrl }]
          : []
      );
      return runWidgetNavigationCommand({
        _tag: "Push",
        path: toWidgetPath(`/activity/${segment}-review/complete`),
        state: { urls },
      });
    }

    if (
      command.action.status === ActionStatus.CREATED ||
      command.action.status === ActionStatus.WAITING_FOR_NEXT ||
      command.action.status === ActionStatus.FAILED
    ) {
      return runWidgetNavigationCommand({
        _tag: "Push",
        path: destination.reviewPath,
      });
    }

    return Effect.void;
  })
  .pipe(Atom.withLabel("resumeActivityActionAtom"));
