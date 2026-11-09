import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { widgetConfigAtom } from "../../../features/widget-configuration/index";

type MountAnimationState = {
  readonly earnPage: boolean;
  readonly layout: boolean;
};

type MountAnimationAction = {
  readonly type: "all" | keyof MountAnimationState;
};

const makeMountAnimationState = (
  finished: boolean,
  layoutFinished = finished
): MountAnimationState => ({
  earnPage: finished,
  layout: layoutFinished,
});

export const isMountAnimationFinished = (state: MountAnimationState) =>
  state.earnPage && state.layout;

const sameMountAnimationState = (
  a: MountAnimationState,
  b: MountAnimationState
) => a.earnPage === b.earnPage && a.layout === b.layout;

export const mountAnimationStateAtom = Atom.writable<
  MountAnimationState,
  MountAnimationAction
>(
  (context) =>
    context.self<MountAnimationState>().pipe(
      Option.getOrElse(() => {
        const widgetConfig = context.once(widgetConfigAtom);

        // A host that disables the frame's reveal has no layout step to wait for.
        return makeMountAnimationState(
          widgetConfig.mountAnimationStartsFinished,
          widgetConfig.mountAnimationStartsFinished ||
            widgetConfig.disableInitLayoutAnimation
        );
      })
    ),
  (context, action) => {
    const state = context.get(mountAnimationStateAtom);
    const next =
      action.type === "all"
        ? makeMountAnimationState(true)
        : { ...state, [action.type]: true };

    if (sameMountAnimationState(state, next)) return;

    context.setSelf(next);
  }
).pipe(Atom.keepAlive, Atom.withLabel("mountAnimationStateAtom"));

export const mountAnimationCompletionAtom = Atom.make((get) => {
  if (!isMountAnimationFinished(get(mountAnimationStateAtom))) return;

  get.once(widgetConfigAtom).onMountAnimationComplete?.();
}).pipe(Atom.withLabel("mountAnimationCompletionAtom"));
