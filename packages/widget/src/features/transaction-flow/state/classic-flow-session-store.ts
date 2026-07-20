import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
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
  const providersDetails = [...intake.providersDetails];

  switch (intake._tag) {
    case "Enter":
      return {
        ...intake,
        providersDetails,
        selectedValidators: new Map(intake.selectedValidators),
      };
    case "ActivityResume":
      return {
        ...intake,
        providersDetails,
        selectedValidators: [...intake.selectedValidators],
      };
    case "Exit":
    case "Manage":
      return { ...intake, providersDetails };
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

export const classicFlowSessionStore = makeClassicFlowSessionStore();
