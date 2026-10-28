import { Context, Data, Effect, Layer } from "effect";
import { ApplicationRouter } from "./application-router";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "./widget-routes";

export type WidgetNavigationOptions = Readonly<{
  readonly scroll?: "preserve" | "reset";
}>;

export type WidgetNavigationCommand =
  | Readonly<
      {
        readonly _tag: "Back";
      } & WidgetNavigationOptions
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

const resetScroll = async (
  options: WidgetNavigationOptions,
  canResetScroll: () => boolean
) => {
  if (options.scroll !== "preserve" && canResetScroll()) {
    globalThis.window?.scrollTo(0, 0);
  }
};

const runNavigation = (
  operation: () => Promise<void> | void
): Effect.Effect<void, WidgetNavigationError> =>
  Effect.tryPromise({
    try: async () => operation(),
    catch: (cause) => new WidgetNavigationError({ cause }),
  });

export type WidgetNavigationService = Readonly<{
  readonly back: (
    options?: WidgetNavigationOptions
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
>()("@stakekit/widget/services/navigation/WidgetNavigation") {
  static readonly layer = (canResetScroll: () => boolean = () => true) =>
    Layer.effect(
      WidgetNavigation,
      ApplicationRouter.useSync(({ router }) => {
        const back: WidgetNavigation["Service"]["back"] = (options = {}) =>
          runNavigation(async () => {
            await resetScroll(options, canResetScroll);
            await router.navigate(-1);
          });
        const push: WidgetNavigation["Service"]["push"] = (to, options = {}) =>
          runNavigation(async () => {
            await resetScroll(options, canResetScroll);
            await router.navigate(widgetTargetPath(to), {
              state: widgetTargetState(to),
            });
          });
        const replace: WidgetNavigation["Service"]["replace"] = (
          to,
          options = {}
        ) =>
          runNavigation(async () => {
            await resetScroll(options, canResetScroll);
            await router.navigate(widgetTargetPath(to), {
              replace: true,
              state: widgetTargetState(to),
            });
          });
        return makeWidgetNavigation({ back, push, replace });
      })
    );
}
