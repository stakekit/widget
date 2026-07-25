import { Context, Effect, Layer } from "effect";
import {
  createMemoryRouter,
  type DataRouter,
  type RouteObject,
} from "react-router";

export class ApplicationRouter extends Context.Service<
  ApplicationRouter,
  {
    readonly router: DataRouter;
  }
>()("@stakekit/widget/services/navigation/ApplicationRouter") {
  static readonly layer = (
    routes: ReadonlyArray<RouteObject>,
    options?: Parameters<typeof createMemoryRouter>[1]
  ) =>
    Layer.effect(
      ApplicationRouter,
      Effect.acquireRelease(
        Effect.sync(() =>
          ApplicationRouter.of({
            router: createMemoryRouter([...routes], options),
          })
        ),
        ({ router }) => Effect.sync(() => router.dispose())
      )
    );
}
