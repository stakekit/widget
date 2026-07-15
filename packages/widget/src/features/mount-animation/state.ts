import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../app/config";
import { config } from "../../shared/config/widget-defaults";

type MountAnimationState = {
  readonly earnPage: boolean;
  readonly layout: boolean;
};

type MountAnimationAction = {
  readonly type: "all" | keyof MountAnimationState;
};

const makeMountAnimationState = (finished = false): MountAnimationState => ({
  earnPage: finished,
  layout: finished,
});

export const mountAnimationStateAtom = Atom.writable<
  MountAnimationState,
  MountAnimationAction
>(
  (context) =>
    context.self<MountAnimationState>().pipe(
      Option.getOrElse(() => {
        const widgetConfig = context.once(widgetConfigAtom);

        return makeMountAnimationState(
          !!widgetConfig.dashboardVariant || config.env.isTestMode
        );
      })
    ),
  (context, action) => {
    const state = context.get(mountAnimationStateAtom);
    context.setSelf(
      action.type === "all"
        ? makeMountAnimationState(true)
        : { ...state, [action.type]: true }
    );
  }
).pipe(Atom.keepAlive, Atom.withLabel("mountAnimationStateAtom"));
