import { Effect } from "effect";
import {
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../services/navigation/widget-navigation";

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

export const runWidgetNavigationCommand = (command: WidgetNavigationCommand) =>
  WidgetNavigation.use((navigation) => {
    switch (command._tag) {
      case "Back":
        return navigation.back(command);
      case "Push":
        return navigation.push(command.path, command);
      case "Replace":
        return navigation.replace(command.path, command);
    }
  }).pipe(Effect.withSpan("runWidgetNavigationCommand"));
