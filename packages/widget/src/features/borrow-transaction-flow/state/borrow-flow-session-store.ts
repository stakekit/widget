import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/config/settings";
import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../../services/navigation/widget-navigation";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../services/wallet/domain/scope";
import { walletScopeAtom } from "../../wallet/state";
import type { BorrowTransactionFlowIntake } from "../model/borrow-transaction-flow";

export type BorrowFlowSession = Readonly<{
  readonly epoch: number;
  readonly intake: BorrowTransactionFlowIntake;
  readonly walletScope: WalletScopeKey;
}>;

type StartBorrowFlowSessionCommand = Readonly<{
  readonly intake: BorrowTransactionFlowIntake;
  readonly navigation: WidgetNavigationCommand | null;
}>;

type StartBorrowFlowSessionOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: BorrowFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedDisabled" }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type BorrowFlowSessionStoreState = Readonly<{
  readonly current: BorrowFlowSession | null;
  readonly nextEpoch: number;
}>;

const initialState: BorrowFlowSessionStoreState = {
  current: null,
  nextEpoch: 1,
};

const copyIntake = (
  intake: BorrowTransactionFlowIntake
): BorrowTransactionFlowIntake => structuredClone(intake);

export const makeBorrowFlowSessionStore = () => {
  const stateAtom = Atom.make<BorrowFlowSessionStoreState>(initialState).pipe(
    Atom.keepAlive,
    Atom.withLabel("borrowFlowSessionStoreAtom")
  );
  const currentSessionAtom = Atom.make((get) => get(stateAtom).current).pipe(
    Atom.withLabel("currentBorrowFlowSessionAtom")
  );
  const startAtom = Atom.fnSync(
    (
      intake: BorrowTransactionFlowIntake,
      context
    ): StartBorrowFlowSessionOutcome => {
      if (!context(widgetConfigAtom).borrowEnabled) {
        return { _tag: "RejectedDisabled" };
      }

      const walletScope = context(walletScopeAtom);
      if (
        !walletScope ||
        !sameWalletScopeOwner(walletScope, {
          address: intake.command.address,
          network: intake.summary.network,
        })
      ) {
        return { _tag: "RejectedOwner" };
      }

      const state = context(stateAtom);
      const session: BorrowFlowSession = {
        epoch: state.nextEpoch,
        intake: copyIntake(intake),
        walletScope: new WalletScopeKey(walletScope),
      };
      context.set(stateAtom, {
        current: session,
        nextEpoch: state.nextEpoch + 1,
      });
      return {
        _tag: "Started",
        session,
      };
    },
    { initialValue: { _tag: "RejectedOwner" } }
  ).pipe(Atom.withLabel("startBorrowFlowSessionAtom"));
  const clearAtom = Atom.fnSync((epoch: number, context) => {
    const state = context(stateAtom);
    if (state.current?.epoch !== epoch) return;
    context.set(stateAtom, { ...state, current: null });
  }).pipe(Atom.withLabel("clearBorrowFlowSessionAtom"));

  return { clearAtom, currentSessionAtom, startAtom, stateAtom } as const;
};

export const borrowFlowSessionStore = makeBorrowFlowSessionStore();

export const startBorrowFlowSessionAtom = appRuntime
  .fn((command: StartBorrowFlowSessionCommand, context) =>
    Effect.gen(function* () {
      context.set(borrowFlowSessionStore.startAtom, command.intake);
      const outcome = context(borrowFlowSessionStore.startAtom);

      if (outcome._tag !== "Started") {
        return outcome;
      }

      const navigationCommand = command.navigation;
      if (!navigationCommand) {
        return outcome;
      }

      yield* WidgetNavigation.use((navigation) =>
        navigation.execute(navigationCommand)
      ).pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            context.set(
              borrowFlowSessionStore.clearAtom,
              outcome.session.epoch
            );
          })
        )
      );
      return outcome;
    })
  )
  .pipe(Atom.withLabel("startBorrowFlowSessionCommandAtom"));
