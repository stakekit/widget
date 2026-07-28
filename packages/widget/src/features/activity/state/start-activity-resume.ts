import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { runWidgetNavigationCommand } from "../../../app/runtime/navigation";
import { ActionStatus } from "../../../domain/types/action";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";
import {
  classicFlowSessionStore,
  makeClassicTransactionFlowDestination,
} from "../../classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../wallet/state";
import type { ActivityActionItem } from "../model/activity-action";

export type ActivityResumeMode = "start-and-navigate" | "start-only";

type StartActivityResume = Readonly<{
  readonly item: ActivityActionItem;
  readonly mode: ActivityResumeMode;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
}>;

const getActivityFlowPathSegment = (
  type: ActivityActionItem["actionData"]["type"]
) => {
  switch (type) {
    case "UNSTAKE":
      return "unstake";
    case "STAKE":
      return "stake";
    default:
      return "pending";
  }
};

export const startActivityResumeAtom = appRuntime
  .fn((command: StartActivityResume, context) => {
    if (context(walletConnectionStateAtom).status !== "connected") {
      return WalletModal.use((modal) => modal.openConnect);
    }
    if (!command.item.yieldData) return Effect.void;

    const segment = getActivityFlowPathSegment(command.item.actionData.type);
    const destination = makeClassicTransactionFlowDestination({
      completePath: `/activity/${segment}/complete`,
      routeBase: "/activity",
      stepsPath: `/activity/${segment}/steps`,
    });
    context.set(classicFlowSessionStore.startAtom, {
      destination,
      intake: {
        _tag: "ActivityResume",
        action: command.item.actionData,
        providersDetails: command.providersDetails,
        selectedValidators: command.item.validatorsData,
        selectedYield: command.item.yieldData,
        walletScope: command.item.walletScope,
      },
    });

    if (command.mode === "start-only") return Effect.void;

    if (
      command.item.actionData.status === ActionStatus.SUCCESS ||
      command.item.actionData.status === ActionStatus.PROCESSING
    ) {
      const urls = command.item.actionData.transactions.flatMap(
        (transaction) =>
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
      command.item.actionData.status === ActionStatus.CREATED ||
      command.item.actionData.status === ActionStatus.WAITING_FOR_NEXT ||
      command.item.actionData.status === ActionStatus.FAILED
    ) {
      return runWidgetNavigationCommand({
        _tag: "Push",
        path: destination.reviewPath,
      });
    }

    return Effect.void;
  })
  .pipe(Atom.withLabel("startActivityResumeAtom"));
