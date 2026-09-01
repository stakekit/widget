import { Context, Effect, Layer, Queue, Stream } from "effect";
import {
  createMemoryRouter,
  type DataRouter,
  type RouteObject,
} from "react-router";

const pathnameStream = (router: DataRouter): Stream.Stream<string> =>
  Stream.callback<string>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const publish = (state: DataRouter["state"]) => {
            Queue.offerUnsafe(queue, state.location.pathname);
          };
          const unsubscribe = router.subscribe(publish);
          publish(router.state);
          return unsubscribe;
        }),
        (unsubscribe) =>
          Effect.sync(() => {
            unsubscribe();
          })
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

export class ApplicationRouter extends Context.Service<
  ApplicationRouter,
  {
    readonly pathnames: Stream.Stream<string>;
    readonly router: DataRouter;
  }
>()("@stakekit/widget/services/navigation/ApplicationRouter") {
  static readonly layer = (
    routes: ReadonlyArray<RouteObject>,
    options?: Parameters<typeof createMemoryRouter>[1]
  ) =>
    Layer.effect(
      ApplicationRouter,
      Effect.gen(function* () {
        const router = yield* Effect.acquireRelease(
          Effect.sync(() => createMemoryRouter([...routes], options)),
          (router) => Effect.sync(() => router.dispose())
        );
        const pathnames = yield* pathnameStream(router).pipe(
          Stream.share({ capacity: 1, replay: 1, strategy: "sliding" })
        );
        return ApplicationRouter.of({ pathnames, router });
      })
    );
}
