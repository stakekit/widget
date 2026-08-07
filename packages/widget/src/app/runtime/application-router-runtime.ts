import { Context, Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RouteObject } from "react-router";
import { initParamsAtom } from "../../features/init-params/state";
import { ApplicationRouter } from "../../services/navigation/application-router";
import { widgetConfigAtom } from "../config/settings";
import { resolveInitialRoutePath } from "../routes/initial-route";

export const applicationRoutesAtom = Atom.make<ReadonlyArray<RouteObject>>([
  { path: "*" },
]).pipe(Atom.withLabel("applicationRoutesAtom"));

const applicationInitialEntriesAtom = Atom.make(
  (get): ReadonlyArray<string> => {
    const config = get.once(widgetConfigAtom);
    const { tab } = get.once(initParamsAtom);

    return [
      resolveInitialRoutePath({
        borrowAvailable: config.borrowEnabled,
        tab,
        variant: config.dashboardVariant ? "dashboard" : "classic",
      }),
    ];
  }
).pipe(Atom.withLabel("applicationInitialEntriesAtom"));

export const applicationRouterRuntime = Atom.runtime((get) =>
  ApplicationRouter.layer(get.registry.get(applicationRoutesAtom), {
    initialEntries: [...get.registry.get(applicationInitialEntriesAtom)],
  }).pipe(Layer.fresh)
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
