import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { ApplicationRouter } from "../../services/navigation/application-router";
import { applicationBaseRuntime } from "./application-base-runtime";

export const applicationRouterAtom = applicationBaseRuntime
  .atom(
    ApplicationRouter.use((applicationRouter) =>
      Effect.succeed(applicationRouter.router)
    )
  )
  .pipe(
    Atom.map(AsyncResult.getOrThrow),
    Atom.withLabel("applicationRouterAtom")
  );

export const applicationRouterPathnameAtom = applicationBaseRuntime
  .atom(
    ApplicationRouter.use((applicationRouter) =>
      Effect.succeed(applicationRouter.pathnames)
    ).pipe(Stream.unwrap)
  )
  .pipe(
    Atom.map((result) =>
      result.pipe(
        AsyncResult.value,
        Option.getOrElse(() => "/")
      )
    ),
    Atom.withLabel("applicationRouterPathnameAtom")
  );
