import { Context, Data, Effect, Layer, Schema } from "effect";
import { ApplicationRouter } from "./application-router";

export const WidgetPath = Schema.TemplateLiteral([
  Schema.Literal("/"),
  Schema.String,
]).pipe(Schema.brand("WidgetPath"));
export type WidgetPath = typeof WidgetPath.Type;
export type WidgetPathInput = typeof WidgetPath.Encoded;

export type WidgetNavigationOptions = Readonly<{
  readonly scroll?: "preserve" | "reset";
  readonly state?: unknown;
}>;

class WidgetNavigationError extends Data.TaggedError("WidgetNavigationError")<{
  readonly cause: unknown;
}> {}

export const toWidgetPath = Schema.decodeSync(WidgetPath);

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

export class WidgetNavigation extends Context.Service<
  WidgetNavigation,
  {
    readonly back: (
      options?: WidgetNavigationOptions
    ) => Effect.Effect<void, WidgetNavigationError>;
    readonly push: (
      path: WidgetPath,
      options?: WidgetNavigationOptions
    ) => Effect.Effect<void, WidgetNavigationError>;
    readonly replace: (
      path: WidgetPath,
      options?: WidgetNavigationOptions
    ) => Effect.Effect<void, WidgetNavigationError>;
  }
>()("@stakekit/widget/services/navigation/WidgetNavigation") {
  static readonly layer = (canResetScroll: () => boolean = () => true) =>
    Layer.effect(
      WidgetNavigation,
      ApplicationRouter.useSync(({ router }) =>
        WidgetNavigation.of({
          back: (options = {}) =>
            runNavigation(async () => {
              await resetScroll(options, canResetScroll);
              await router.navigate(-1);
            }),
          push: (path, options = {}) =>
            runNavigation(async () => {
              await resetScroll(options, canResetScroll);
              await router.navigate(path, { state: options.state });
            }),
          replace: (path, options = {}) =>
            runNavigation(async () => {
              await resetScroll(options, canResetScroll);
              await router.navigate(path, {
                replace: true,
                state: options.state,
              });
            }),
        })
      )
    );
}
