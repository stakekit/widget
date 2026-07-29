import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";
import {
  makeClassicTransactionFlowDestination,
  startClassicFlowSessionAtom,
} from "../../classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../wallet/state";
import {
  type ActivityActionItem,
  getActivityActionOpenTarget,
} from "../model/activity-action";

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
    const openTarget = getActivityActionOpenTarget(
      command.item.actionData.status
    );
    if (!openTarget) return Effect.void;

    const segment = getActivityFlowPathSegment(command.item.actionData.type);
    const destination = makeClassicTransactionFlowDestination({
      completePath: `/activity/${segment}/complete`,
      routeBase: "/activity",
      stepsPath: `/activity/${segment}/steps`,
    });
    const navigation = (() => {
      if (command.mode === "start-only") return null;
      if (openTarget === "HistoricalDetails") {
        return {
          _tag: "Push" as const,
          path: toWidgetPath(`/activity/${segment}-review/complete`),
          state: {
            urls: command.item.actionData.transactions.flatMap((transaction) =>
              transaction.explorerUrl
                ? [
                    {
                      type: transaction.type,
                      url: transaction.explorerUrl,
                    },
                  ]
                : []
            ),
          },
        };
      }
      return {
        _tag: "Push" as const,
        path: destination.reviewPath,
      };
    })();

    return context.setResult(startClassicFlowSessionAtom, {
      destination,
      intake: {
        _tag: "ActivityResume",
        action: command.item.actionData,
        providersDetails: command.providersDetails,
        selectedValidators: command.item.validatorsData,
        selectedYield: command.item.yieldData,
        walletScope: command.item.walletScope,
      },
      navigation,
    });
  })
  .pipe(Atom.withLabel("startActivityResumeAtom"));
