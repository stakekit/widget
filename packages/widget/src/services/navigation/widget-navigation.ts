import { Context, Data, Effect, Layer } from "effect";
import type { DataRouter } from "react-router";

import { ApplicationRouter } from "./application-router";
import type { ScrollReset, ScrollResetRequest } from "./scroll-reset";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "./widget-routes";

export type WidgetNavigationOptions = Readonly<{
  readonly scroll?: "preserve" | "reset";
}>;

/** Going back: one history entry unless `steps` says more. */
type WidgetBackOptions = WidgetNavigationOptions &
  Readonly<{ readonly steps?: number }>;

export type WidgetNavigationCommand =
  | Readonly<
      {
        readonly _tag: "Back";
      } & WidgetBackOptions
    >
  | Readonly<
      {
        readonly _tag: "Push";
        readonly to: WidgetNavigationTarget;
      } & WidgetNavigationOptions
    >
  | Readonly<
      {
        readonly _tag: "Replace";
        readonly to: WidgetNavigationTarget;
      } & WidgetNavigationOptions
    >;

export class WidgetNavigationError extends Data.TaggedError(
  "WidgetNavigationError"
)<{
  readonly cause: unknown;
}> {}

const runNavigation = (
  operation: () => Promise<void> | void
): Effect.Effect<void, WidgetNavigationError> =>
  Effect.tryPromise({
    try: () => Promise.resolve(operation()),
    catch: (cause) => new WidgetNavigationError({ cause }),
  });

/** A blocker holds a navigation while it waits for the user, then proceeds. */
const blockerHoldsNavigation = (state: DataRouter["state"]): boolean =>
  Array.from(state.blockers.values()).some(
    (blocker) => blocker.state === "blocked" || blocker.state === "proceeding"
  );

/**
 * Drops `request` once its navigation settles on the location it started
 * from. A blocked navigation keeps it until the user leaves, which commits the
 * next page, or stays.
 */
const settleScrollReset = (
  router: DataRouter,
  scrollReset: ScrollReset,
  request: ScrollResetRequest
): void => {
  if (router.state.location.key !== request.from) return;
  if (!blockerHoldsNavigation(router.state)) {
    scrollReset.cancel(request);
    return;
  }
  const unsubscribe = router.subscribe((state) => {
    if (blockerHoldsNavigation(state)) return;
    unsubscribe();
    if (state.location.key === request.from) scrollReset.cancel(request);
  });
};

export type WidgetNavigationService = Readonly<{
  readonly back: (
    options?: WidgetBackOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly execute: (
    command: WidgetNavigationCommand
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly push: (
    to: WidgetNavigationTarget,
    options?: WidgetNavigationOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly replace: (
    to: WidgetNavigationTarget,
    options?: WidgetNavigationOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
}>;

export const makeWidgetNavigation = (
  methods: Omit<WidgetNavigationService, "execute">
): WidgetNavigationService => ({
  ...methods,
  execute: (command) => {
    switch (command._tag) {
      case "Back":
        return methods.back(command);
      case "Push":
        return methods.push(command.to, command);
      case "Replace":
        return methods.replace(command.to, command);
    }
  },
});

export class WidgetNavigation extends Context.Service<
  WidgetNavigation,
  WidgetNavigationService
>()("@stakekit/widget/services/navigation/widget-navigation/WidgetNavigation") {
  static readonly layer = (canResetScroll: () => boolean = () => true) =>
    Layer.effect(
      WidgetNavigation,
      ApplicationRouter.useSync(({ router, scrollReset }) => {
        // The reset runs when the next page commits; a navigation that keeps
        // the location drops it.
        const navigateWithScroll = (
          options: WidgetNavigationOptions,
          routerNavigation: () => Promise<void>
        ) =>
          Effect.suspend(() => {
            if (options.scroll === "preserve" || !canResetScroll()) {
              return runNavigation(routerNavigation);
            }
            const request = scrollReset.request(router.state.location.key);
            return runNavigation(routerNavigation).pipe(
              Effect.ensuring(
                Effect.sync(() =>
                  settleScrollReset(router, scrollReset, request)
                )
              )
            );
          });
        const back: WidgetNavigation["Service"]["back"] = (options = {}) =>
          navigateWithScroll(options, () =>
            router.navigate(-(options.steps ?? 1))
          );
        const push: WidgetNavigation["Service"]["push"] = (to, options = {}) =>
          navigateWithScroll(options, () =>
            router.navigate(widgetTargetPath(to), {
              state: widgetTargetState(to),
            })
          );
        const replace: WidgetNavigation["Service"]["replace"] = (
          to,
          options = {}
        ) =>
          navigateWithScroll(options, () =>
            router.navigate(widgetTargetPath(to), {
              replace: true,
              state: widgetTargetState(to),
            })
          );
        return makeWidgetNavigation({ back, push, replace });
      })
    );
}
