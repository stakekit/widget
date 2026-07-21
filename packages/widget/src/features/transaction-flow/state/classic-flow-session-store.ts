import BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import type { ClassicTransactionFlowIntake } from "../model/classic-transaction-flow";

export type ClassicFlowSession = Readonly<{
  readonly epoch: number;
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
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlowIntake => {
  switch (intake._tag) {
    case "Enter": {
      const { walletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "ActivityResume": {
      const { walletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Exit": {
      const { unstakeAmount, walletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        unstakeAmount: new BigNumber(unstakeAmount),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Manage": {
      const { walletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
  }
};

export const makeClassicFlowSessionStore = () => {
  const stateAtom = Atom.make<ClassicFlowSessionStoreState>(initialState).pipe(
    Atom.keepAlive,
    Atom.withLabel("classicFlowSessionStoreAtom")
  );

  const currentSessionAtom = Atom.make((get) => get(stateAtom).current).pipe(
    Atom.withLabel("currentClassicFlowSessionAtom")
  );

  const startAtom = Atom.fnSync(
    (intake: ClassicTransactionFlowIntake, context) => {
      const state = context(stateAtom);
      const session: ClassicFlowSession = {
        epoch: state.nextEpoch,
        intake: copyIntake(intake),
      };

      context.set(stateAtom, {
        current: session,
        nextEpoch: state.nextEpoch + 1,
      });
      return session;
    }
  ).pipe(Atom.withLabel("startClassicFlowSessionAtom"));

  const clearAtom = Atom.fnSync((epoch: number, context) => {
    const state = context(stateAtom);
    if (state.current?.epoch !== epoch) return;

    context.set(stateAtom, { ...state, current: null });
  }).pipe(Atom.withLabel("clearClassicFlowSessionAtom"));

  return {
    clearAtom,
    currentSessionAtom,
    startAtom,
  } as const;
};

export type ClassicFlowSessionStore = ReturnType<
  typeof makeClassicFlowSessionStore
>;

export const classicFlowSessionStore = makeClassicFlowSessionStore();
