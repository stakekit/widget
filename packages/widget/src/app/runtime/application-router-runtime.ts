import { Context, Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RouteObject } from "react-router";
import { ApplicationRouter } from "../../services/navigation/application-router";

/**
 * Construction-time route configuration for one Application Runtime
 * Generation. The top-level React composition seam assembles the root route
 * and seeds it when it creates the registry; the placeholder keeps a matching
 * catch-all for headless navigation tests.
 */
export const applicationRoutesAtom = Atom.make<ReadonlyArray<RouteObject>>([
  { path: "*" },
]).pipe(Atom.withLabel("applicationRoutesAtom"));

export const applicationRouterRuntime = Atom.runtime((get) =>
  ApplicationRouter.layer(get.registry.get(applicationRoutesAtom)).pipe(
    Layer.fresh
  )
).pipe(Atom.keepAlive);

const applicationRouterContextResultAtom = applicationRouterRuntime
  .atom(Effect.context<ApplicationRouter>())
  .pipe(Atom.withLabel("applicationRouterContextResultAtom"));

export const applicationRouterContextAtom = Atom.make((get) =>
  AsyncResult.getOrThrow(get(applicationRouterContextResultAtom))
).pipe(Atom.withLabel("applicationRouterContextAtom"));

export const applicationRouterAtom = Atom.make(
  (get) =>
    Context.get(get(applicationRouterContextAtom), ApplicationRouter).router
).pipe(Atom.withLabel("applicationRouterAtom"));
