import { Effect, Layer, Ref } from "effect";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../../src/services/navigation/widget-navigation";

export type TestNavigationOptions = Readonly<{
  readonly execute?: WidgetNavigation["Service"]["execute"];
}>;

export const makeTestNavigation = Effect.fn("makeTestNavigation")(function* (
  options: TestNavigationOptions = {}
) {
  const commands = yield* Ref.make<ReadonlyArray<WidgetNavigationCommand>>([]);
  const execute = Effect.fn("makeTestNavigation.execute")(function* (
    command: WidgetNavigationCommand
  ) {
    yield* Ref.update(commands, (current) => [...current, command]);
    if (options.execute) {
      yield* options.execute(command);
    }
  });
  const service = makeWidgetNavigation({
    back: (navigationOptions) =>
      execute({ ...navigationOptions, _tag: "Back" }),
    push: (path, navigationOptions) =>
      execute({ ...navigationOptions, _tag: "Push", path }),
    replace: (path, navigationOptions) =>
      execute({ ...navigationOptions, _tag: "Replace", path }),
  });

  return {
    clear: Ref.set(commands, []),
    commands: Ref.get(commands),
    layer: Layer.succeed(WidgetNavigation, service),
    service,
  } as const;
});
