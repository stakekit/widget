import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { walletScopeAtom } from "../../wallet/state";
import type {
  ClassicTransactionFlowDestination,
  ClassicTransactionFlowIntake,
} from "../model/classic-transaction-flow";
import { isClassicTransactionFlowWalletScopeValid } from "../model/classic-transaction-flow";

export type ClassicFlowSession = Readonly<{
  readonly activityPresentation?: "Classic" | "Dashboard";
  readonly destination: ClassicTransactionFlowDestination;
  readonly epoch: number;
  readonly intake: ClassicTransactionFlowIntake;
}>;

type StartClassicFlowSession = Readonly<{
  readonly activityPresentation?: "Classic" | "Dashboard";
  readonly destination: ClassicTransactionFlowDestination;
  readonly intake: ClassicTransactionFlowIntake;
}>;

type ClassicFlowSessionStoreState = Readonly<{
  readonly current: ClassicFlowSession | null;
  readonly nextEpoch: number;
}>;

const initialState: ClassicFlowSessionStoreState = {
  current: null,
  nextEpoch: 1,
};

const copyIntake = (
  intake: ClassicTransactionFlowIntake,
  walletScope: WalletScopeKey
): ClassicTransactionFlowIntake => {
  switch (intake._tag) {
    case "Enter": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "ActivityResume": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Exit": {
      const {
        unstakeAmount,
        walletScope: _expectedWalletScope,
        ...facts
      } = intake;
      return {
        ...structuredClone(facts),
        unstakeAmount: new BigNumber(unstakeAmount),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Manage": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
  }
};

const classicFlowSessionStateAtom = Atom.writable<
  ClassicFlowSessionStoreState,
  ClassicFlowSessionStoreState
>(
  (context) => {
    const previous = context
      .self<ClassicFlowSessionStoreState>()
      .pipe(Option.getOrElse(() => initialState));
    const currentWalletScope = context.get(walletScopeAtom);

    return previous.current &&
      !isClassicTransactionFlowWalletScopeValid(
        previous.current.intake,
        currentWalletScope
      )
      ? { ...previous, current: null }
      : previous;
  },
  (context, state) => context.setSelf(state)
).pipe(Atom.keepAlive, Atom.withLabel("classicFlowSessionStoreAtom"));

const currentSessionAtom = Atom.make(
  (get) => get(classicFlowSessionStateAtom).current
).pipe(Atom.withLabel("currentClassicFlowSessionAtom"));

const startAtom = Atom.fnSync(
  (
    { activityPresentation, destination, intake }: StartClassicFlowSession,
    context
  ) => {
    const currentWalletScope = context(walletScopeAtom);
    if (
      !currentWalletScope ||
      !isClassicTransactionFlowWalletScopeValid(intake, currentWalletScope)
    ) {
      return null;
    }

    const state = context(classicFlowSessionStateAtom);
    const session: ClassicFlowSession = {
      activityPresentation,
      destination,
      epoch: state.nextEpoch,
      intake: copyIntake(intake, currentWalletScope),
    };

    context.set(classicFlowSessionStateAtom, {
      current: session,
      nextEpoch: state.nextEpoch + 1,
    });
    return session;
  },
  { initialValue: null }
).pipe(Atom.withLabel("startClassicFlowSessionAtom"));

const clearAtom = Atom.fnSync((epoch: number, context) => {
  const state = context(classicFlowSessionStateAtom);
  if (state.current?.epoch !== epoch) return;

  context.set(classicFlowSessionStateAtom, { ...state, current: null });
}).pipe(Atom.withLabel("clearClassicFlowSessionAtom"));

export const classicFlowSessionStore = {
  clearAtom,
  currentSessionAtom,
  startAtom,
} as const;
