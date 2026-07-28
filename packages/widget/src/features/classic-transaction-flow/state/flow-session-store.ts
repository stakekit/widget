import BigNumber from "bignumber.js";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { runWidgetNavigationCommand } from "../../../app/runtime/navigation";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import type {
  ClassicTransactionFlowDestination,
  ClassicTransactionFlowIntake,
} from "../model/classic-transaction-flow";
import { makeClassicTransactionFlowDestination as makeDestination } from "../model/classic-transaction-flow";

export type ClassicFlowSession = Readonly<{
  readonly destination: ClassicTransactionFlowDestination;
  readonly epoch: number;
  readonly intake: ClassicTransactionFlowIntake;
}>;

const removeOptionalTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

const getPathSegments = (pathname: string): ReadonlyArray<string> =>
  removeOptionalTrailingSlash(pathname).split("/").filter(Boolean);

const isActivityResumeSessionPath = (
  session: ClassicFlowSession,
  pathname: string
): boolean => {
  const pathnameSegments = getPathSegments(pathname);
  const reviewPathSegments = getPathSegments(session.destination.reviewPath);
  const routeBaseSegments = reviewPathSegments.slice(0, -1);

  if (
    routeBaseSegments.some(
      (segment, index) => pathnameSegments[index] !== segment
    )
  ) {
    return false;
  }

  const relativeSegments = pathnameSegments.slice(routeBaseSegments.length);
  if (relativeSegments.length === 1) {
    return relativeSegments[0] === "review";
  }
  if (relativeSegments.length !== 2) return false;

  return relativeSegments[1] === "steps" || relativeSegments[1] === "complete";
};

export const isClassicFlowSessionPath = (
  session: ClassicFlowSession,
  pathname: string
): boolean => {
  const normalizedPathname = removeOptionalTrailingSlash(pathname);

  if (session.intake._tag === "ActivityResume") {
    return isActivityResumeSessionPath(session, normalizedPathname);
  }

  return Object.values(session.destination).some(
    (destination) => destination === normalizedPathname
  );
};

type StartClassicFlowSession = Readonly<{
  readonly destination: ClassicTransactionFlowDestination;
  readonly intake: ClassicTransactionFlowIntake;
}>;

export const makeStartClassicFlowSession = (
  intake: ClassicTransactionFlowIntake
): StartClassicFlowSession => ({
  destination: makeDestination({ routeBase: "" }),
  intake,
});

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
    ({ destination, intake }: StartClassicFlowSession, context) => {
      const state = context(stateAtom);
      const session: ClassicFlowSession = {
        destination,
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

export const classicFlowSessionStore = makeClassicFlowSessionStore();

export const finishClassicTransactionFlowAtom = appRuntime
  .fn((epoch: number, context) => {
    if (context(classicFlowSessionStore.currentSessionAtom)?.epoch !== epoch) {
      return Effect.succeed("stale-session" as const);
    }
    return runWidgetNavigationCommand({
      _tag: "Push",
      path: toWidgetPath("/"),
    }).pipe(Effect.as("finished" as const));
  })
  .pipe(Atom.withLabel("finishClassicTransactionFlowAtom"));
