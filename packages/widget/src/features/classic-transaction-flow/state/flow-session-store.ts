import BigNumber from "bignumber.js";
import { Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  runWidgetNavigationCommand,
  type WidgetNavigationCommand,
} from "../../../app/runtime/navigation";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { walletScopeAtom } from "../../wallet/state";
import type {
  ClassicTransactionFlowDestination,
  ClassicTransactionFlowIntake,
} from "../model/classic-transaction-flow";
import { isClassicTransactionFlowWalletScopeValid } from "../model/classic-transaction-flow";

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

type StartClassicFlowSessionCommand = StartClassicFlowSession &
  Readonly<{
    readonly navigation: WidgetNavigationCommand | null;
  }>;

type StartClassicFlowSessionOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: ClassicFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

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
  ({ destination, intake }: StartClassicFlowSession, context) => {
    const currentWalletScope = context(walletScopeAtom);
    if (
      !currentWalletScope ||
      !isClassicTransactionFlowWalletScopeValid(intake, currentWalletScope)
    ) {
      return null;
    }

    const state = context(classicFlowSessionStateAtom);
    const session: ClassicFlowSession = {
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

export const startClassicFlowSessionAtom = appRuntime
  .fn((command: StartClassicFlowSessionCommand, context) =>
    Effect.gen(function* () {
      const { navigation, ...start } = command;
      context.set(classicFlowSessionStore.startAtom, start);
      const session = context(classicFlowSessionStore.startAtom);
      if (!session) {
        return {
          _tag: "RejectedOwner",
        } satisfies StartClassicFlowSessionOutcome;
      }

      const outcome = {
        _tag: "Started",
        session,
      } satisfies StartClassicFlowSessionOutcome;
      if (!navigation) return outcome;

      yield* runWidgetNavigationCommand(navigation).pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            context.set(classicFlowSessionStore.clearAtom, session.epoch);
          })
        )
      );
      return outcome;
    })
  )
  .pipe(Atom.withLabel("startClassicFlowSessionCommandAtom"));

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
