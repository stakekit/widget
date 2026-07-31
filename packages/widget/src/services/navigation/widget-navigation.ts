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

export type WidgetNavigationCommand =
  | Readonly<
      {
        readonly _tag: "Back";
      } & WidgetNavigationOptions
    >
  | Readonly<
      {
        readonly _tag: "Push";
        readonly path: WidgetPath;
      } & WidgetNavigationOptions
    >
  | Readonly<
      {
        readonly _tag: "Replace";
        readonly path: WidgetPath;
      } & WidgetNavigationOptions
    >;

export class WidgetNavigationError extends Data.TaggedError(
  "WidgetNavigationError"
)<{
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

export type WidgetNavigationService = Readonly<{
  readonly back: (
    options?: WidgetNavigationOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly execute: (
    command: WidgetNavigationCommand
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly push: (
    path: WidgetPath,
    options?: WidgetNavigationOptions
  ) => Effect.Effect<void, WidgetNavigationError>;
  readonly replace: (
    path: WidgetPath,
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
        return methods.push(command.path, command);
      case "Replace":
        return methods.replace(command.path, command);
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
        const push: WidgetNavigation["Service"]["push"] = (
          path,
          options = {}
        ) =>
          runNavigation(async () => {
            await resetScroll(options, canResetScroll);
            await router.navigate(path, { state: options.state });
          });
        const replace: WidgetNavigation["Service"]["replace"] = (
          path,
          options = {}
        ) =>
          runNavigation(async () => {
            await resetScroll(options, canResetScroll);
            await router.navigate(path, {
              replace: true,
              state: options.state,
            });
          });
        return makeWidgetNavigation({ back, push, replace });
      })
    );
}
