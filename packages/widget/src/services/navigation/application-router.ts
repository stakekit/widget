import { Context, Effect, Layer, Queue, Stream } from "effect";
import {
  createMemoryRouter,
  type DataRouter,
  type Location,
  type RouteObject,
} from "react-router";

/** The router's current location; match its pathname with registry routes. */
export type ApplicationLocation = Readonly<Pick<Location, "pathname">>;

const locationStream = (
  router: DataRouter
): Stream.Stream<ApplicationLocation> =>
  Stream.callback<ApplicationLocation>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const publish = (state: DataRouter["state"]) => {
            Queue.offerUnsafe(queue, { pathname: state.location.pathname });
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
    readonly locations: Stream.Stream<ApplicationLocation>;
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
        const locations = yield* locationStream(router).pipe(
          Stream.share({ capacity: 1, replay: 1, strategy: "sliding" })
        );
        return ApplicationRouter.of({ locations, router });
      })
    );
}
