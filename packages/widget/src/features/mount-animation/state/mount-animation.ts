import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/runtime/widget-config";

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

        return makeMountAnimationState(
          widgetConfig.mountAnimationStartsFinished
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
