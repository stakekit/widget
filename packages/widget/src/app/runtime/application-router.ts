import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import {
  type ApplicationLocation,
  ApplicationRouter,
} from "../../services/navigation/application-router";
import { widgetRoutes } from "../../services/navigation/widget-routes";
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

export const applicationRouterLocationAtom = applicationBaseRuntime
  .atom(
    ApplicationRouter.use((applicationRouter) =>
      Effect.succeed(applicationRouter.locations)
    ).pipe(Stream.unwrap)
  )
  .pipe(
    Atom.map((result) =>
      result.pipe(
        AsyncResult.value,
        Option.getOrElse(
          (): ApplicationLocation => ({ pathname: widgetRoutes.earn.build() })
        )
      )
    ),
    Atom.withLabel("applicationRouterLocationAtom")
  );
