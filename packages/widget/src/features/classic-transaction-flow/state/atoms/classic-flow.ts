import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  type ClassicFlowSession,
  isClassicFlowSessionPath,
  type StartClassicTransactionFlow,
} from "../../model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../orchestration/classic-transaction-flow-service";

export const classicTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(ClassicTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("classicTransactionFlowServiceAtom"));

const currentClassicFlowSessionResultAtom = walletRuntime
  .atom((context) =>
    Stream.unwrap(
      context
        .result(classicTransactionFlowServiceAtom)
        .pipe(Effect.map((service) => service.currentSession))
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("currentClassicFlowSessionResultAtom"));

export const currentClassicFlowSessionAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(currentClassicFlowSessionResultAtom), () => null)
).pipe(Atom.withLabel("currentClassicFlowSessionAtom"));

export const startClassicTransactionFlowAtom = walletRuntime
  .fn((input: StartClassicTransactionFlow, context) =>
    context
      .result(classicTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(input)))
  )
  .pipe(Atom.withLabel("startClassicTransactionFlowAtom"));

export const isActiveClassicTransactionFlowPathAtom = Atom.family(
  (pathname: string) =>
    Atom.make((get) => {
      const session = get(currentClassicFlowSessionAtom);
      return session ? isClassicFlowSessionPath(session, pathname) : false;
    }).pipe(Atom.withLabel("isActiveClassicTransactionFlowPath"))
);

const abandonActivityResumeAtomFamily = Atom.family(
  (session: ClassicFlowSession | null) =>
    walletRuntime
      .fn((_input: undefined, context) =>
        session
          ? context
              .result(classicTransactionFlowServiceAtom)
              .pipe(
                Effect.flatMap((service) =>
                  service.abandonActivityResume(session)
                )
              )
          : Effect.succeed({ _tag: "RejectedStale" } as const)
      )
      .pipe(Atom.withLabel("abandonActivityResume"))
);

export const activityResumeDashboardCommandAtom = Atom.make((get) => {
  const session = get(currentClassicFlowSessionAtom);
  const boundSession =
    session?.activityPresentation === "Dashboard" &&
    session.intake._tag === "ActivityResume"
      ? session
      : null;
  return abandonActivityResumeAtomFamily(boundSession);
}).pipe(Atom.withLabel("activityResumeDashboardCommand"));

export const activityResumeDashboardViewAtom = Atom.make((get) => {
  const session = get(currentClassicFlowSessionAtom);
  if (
    session?.activityPresentation !== "Dashboard" ||
    session.intake._tag !== "ActivityResume"
  ) {
    return { _tag: "Closed" } as const;
  }

  return { _tag: "Open" } as const;
}).pipe(Atom.withLabel("activityResumeDashboardView"));
