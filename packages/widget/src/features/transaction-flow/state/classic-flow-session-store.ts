import BigNumber from "bignumber.js";
import { Data, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import type { ClassicTransactionFlowIntake } from "../model/classic-transaction-flow";

declare const ClassicFlowSessionKeyTypeId: unique symbol;

type ClassicFlowSessionKey = number & {
  readonly [ClassicFlowSessionKeyTypeId]: typeof ClassicFlowSessionKeyTypeId;
};

export class ClassicFlowSession extends Data.Class<{
  readonly intake: ClassicTransactionFlowIntake;
  readonly key: ClassicFlowSessionKey;
}> {}

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

type ClassicFlowSessionStoreState = {
  readonly current: ClassicFlowSession | null;
  readonly generation: number;
};

const initialState: ClassicFlowSessionStoreState = {
  current: null,
  generation: 0,
};

export const makeClassicFlowSessionStore = ({
  runtime,
}: {
  readonly runtime?: typeof appRuntime;
} = {}) => {
  const stateAtom = Atom.make<ClassicFlowSessionStoreState>(initialState).pipe(
    Atom.keepAlive,
    Atom.withLabel("classicFlowSessionStoreAtom")
  );
  const runtimeLifecycleAtom = runtime
    ?.atom((context) =>
      Effect.acquireRelease(Effect.void, () =>
        Effect.sync(() => {
          context.set(stateAtom, initialState);
        })
      )
    )
    .pipe(Atom.keepAlive, Atom.withLabel("classicFlowSessionStoreLifecycle"));

  const currentSessionAtom = Atom.make((get) => {
    if (runtimeLifecycleAtom) get(runtimeLifecycleAtom);
    return get(stateAtom).current;
  }).pipe(Atom.withLabel("currentClassicFlowSessionAtom"));

  const startAtom = Atom.fnSync(
    (intake: ClassicTransactionFlowIntake, context) => {
      if (runtimeLifecycleAtom) context(runtimeLifecycleAtom);
      const state = context(stateAtom);
      const generation = state.generation + 1;
      const session = new ClassicFlowSession({
        intake: copyIntake(intake),
        key: generation as ClassicFlowSessionKey,
      });

      context.set(stateAtom, { current: session, generation });
      return session;
    }
  ).pipe(Atom.withLabel("startClassicFlowSessionAtom"));

  const clearAtom = Atom.fnSync((key: ClassicFlowSessionKey, context) => {
    const state = context(stateAtom);
    if (state.current?.key !== key) return;

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

export const classicFlowSessionStore = makeClassicFlowSessionStore({
  runtime: appRuntime,
});
