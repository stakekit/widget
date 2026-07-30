import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  runWidgetNavigationCommand,
  type WidgetNavigationCommand,
} from "../../../app/runtime/navigation";
import { toWidgetPath } from "../../../services/navigation/widget-navigation";
import type {
  ClassicTransactionFlowDestination,
  ClassicTransactionFlowIntake,
} from "../model/classic-transaction-flow";
import { makeClassicTransactionFlowDestination } from "../model/classic-transaction-flow";
import {
  type ClassicFlowSession,
  classicFlowSessionStore,
} from "./flow-session-store";

type ClassicTransactionFlowMount =
  | Readonly<{
      readonly _tag: "ActivityResume";
      readonly presentation: "Classic" | "Dashboard";
      readonly target: "FreshReview" | "HistoricalDetails";
    }>
  | Readonly<{ readonly _tag: "Earn" }>
  | Readonly<{
      readonly _tag: "PositionExit";
      readonly balanceId: string;
      readonly integrationId: string;
    }>
  | Readonly<{
      readonly _tag: "PositionManage";
      readonly balanceId: string;
      readonly integrationId: string;
    }>
  | Readonly<{
      readonly _tag: "PositionStake";
      readonly balanceId: string;
      readonly integrationId: string;
    }>;

export type ClassicTransactionFlowEnterMount = Extract<
  ClassicTransactionFlowMount,
  { readonly _tag: "Earn" | "PositionStake" }
>;

type StartClassicTransactionFlow =
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Enter" }
      >;
      readonly mount: ClassicTransactionFlowEnterMount;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Exit" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "PositionExit" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Manage" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "PositionManage" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "ActivityResume" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "ActivityResume" }
      >;
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

const isClassicFlowSessionPath = (
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

const getActivityFlowPathSegment = (
  type: Extract<
    ClassicTransactionFlowIntake,
    { readonly _tag: "ActivityResume" }
  >["action"]["type"]
): "pending" | "stake" | "unstake" => {
  switch (type) {
    case "STAKE":
      return "stake";
    case "UNSTAKE":
      return "unstake";
    default:
      return "pending";
  }
};

const getClassicTransactionFlowDestination = (
  command: StartClassicTransactionFlow
): ClassicTransactionFlowDestination => {
  const { mount } = command;
  switch (mount._tag) {
    case "ActivityResume": {
      if (command.intake._tag !== "ActivityResume") {
        throw new Error("Expected Activity Resume intake.");
      }
      const segment = getActivityFlowPathSegment(command.intake.action.type);
      return makeClassicTransactionFlowDestination({
        completePath: `/activity/${segment}/complete`,
        routeBase: "/activity",
        stepsPath: `/activity/${segment}/steps`,
      });
    }
    case "Earn":
      return makeClassicTransactionFlowDestination({ routeBase: "" });
    case "PositionStake":
      return makeClassicTransactionFlowDestination({
        routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/stake`,
      });
    case "PositionExit":
      return makeClassicTransactionFlowDestination({
        routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/unstake`,
      });
    case "PositionManage":
      return makeClassicTransactionFlowDestination({
        routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/pending-action`,
      });
  }
};

const getClassicTransactionFlowStartNavigation = (
  command: StartClassicTransactionFlow,
  destination: ClassicTransactionFlowDestination
): WidgetNavigationCommand | null => {
  if (command.mount._tag !== "ActivityResume") {
    return { _tag: "Push", path: destination.reviewPath };
  }
  if (command.mount.presentation === "Dashboard") return null;
  if (command.mount.target === "FreshReview") {
    return { _tag: "Push", path: destination.reviewPath };
  }
  if (command.intake._tag !== "ActivityResume") {
    throw new Error("Expected Activity Resume intake.");
  }

  const segment = getActivityFlowPathSegment(command.intake.action.type);
  return {
    _tag: "Push",
    path: toWidgetPath(`/activity/${segment}-review/complete`),
    state: {
      urls: command.intake.action.transactions.flatMap((transaction) =>
        transaction.explorerUrl
          ? [{ type: transaction.type, url: transaction.explorerUrl }]
          : []
      ),
    },
  };
};

export const startClassicTransactionFlowAtom = appRuntime
  .fn((command: StartClassicTransactionFlow, context) =>
    Effect.gen(function* () {
      const destination = getClassicTransactionFlowDestination(command);
      context.set(classicFlowSessionStore.startAtom, {
        ...(command.mount._tag === "ActivityResume"
          ? { activityPresentation: command.mount.presentation }
          : {}),
        destination,
        intake: command.intake,
      });
      const session = context(classicFlowSessionStore.startAtom);
      if (!session) return { _tag: "RejectedOwner" } as const;

      const navigation = getClassicTransactionFlowStartNavigation(
        command,
        destination
      );
      if (navigation) {
        yield* runWidgetNavigationCommand(navigation).pipe(
          Effect.tapError(() =>
            Effect.sync(() => {
              context.set(classicFlowSessionStore.clearAtom, session.epoch);
            })
          )
        );
      }

      return { _tag: "Started" } as const;
    })
  )
  .pipe(Atom.withLabel("startClassicTransactionFlowAtom"));

export const isActiveClassicTransactionFlowPathAtom = Atom.family(
  (pathname: string) =>
    Atom.make((get) => {
      const session = get(classicFlowSessionStore.currentSessionAtom);
      return session ? isClassicFlowSessionPath(session, pathname) : false;
    }).pipe(Atom.withLabel("isActiveClassicTransactionFlowPath"))
);

const abandonActivityResumeAtomFamily = Atom.family(
  (session: ClassicFlowSession | null) =>
    appRuntime
      .fn((_input: undefined, context) => {
        const current = context(classicFlowSessionStore.currentSessionAtom);
        if (
          !session ||
          current?.epoch !== session.epoch ||
          current.activityPresentation !== "Dashboard" ||
          current.intake._tag !== "ActivityResume"
        ) {
          return Effect.void;
        }

        context.set(classicFlowSessionStore.clearAtom, session.epoch);
        return runWidgetNavigationCommand({
          _tag: "Push",
          path: toWidgetPath("/activity"),
        });
      })
      .pipe(Atom.withLabel("abandonActivityResume"))
);

export const activityResumeDashboardCommandAtom = Atom.make((get) => {
  const session = get(classicFlowSessionStore.currentSessionAtom);
  const boundSession =
    session?.activityPresentation === "Dashboard" &&
    session.intake._tag === "ActivityResume"
      ? session
      : null;
  return abandonActivityResumeAtomFamily(boundSession);
}).pipe(Atom.withLabel("activityResumeDashboardCommand"));

export const activityResumeDashboardViewAtom = Atom.make((get) => {
  const session = get(classicFlowSessionStore.currentSessionAtom);
  if (
    session?.activityPresentation !== "Dashboard" ||
    session.intake._tag !== "ActivityResume"
  ) {
    return { _tag: "Closed" } as const;
  }

  return {
    _tag: "Open",
  } as const;
}).pipe(Atom.withLabel("activityResumeDashboardView"));
