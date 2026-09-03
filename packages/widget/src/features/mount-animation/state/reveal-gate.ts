import { Duration, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  isMountRevealSettled,
  makeMountRevealGate,
  observeMountRevealFrame,
} from "../model/reveal-gate";

/**
 * The reveal never starts earlier than this after the widget commits. The
 * commit tail — chunk evaluation, wallet connector construction — is dispatched
 * asynchronously and is invisible to frame pacing until it runs, so a gate that
 * only watched frames would open in the quiet moment before it and be starved
 * anyway. This is the wait the reveal already had.
 */
const revealFloor = Duration.millis(300);

/**
 * How much longer than the floor the reveal will wait for the main thread. Past
 * this the reveal starts regardless, so a permanently busy thread, a hidden tab
 * where frames never arrive, or a host without `requestAnimationFrame` can
 * never leave the widget unrevealed.
 */
const revealSettleLimit = Duration.millis(300);

/**
 * Named DOM boundary: `requestAnimationFrame` is the only signal a browser
 * gives for "a frame was actually served", so the settle decision has to be fed
 * from it. The callback owns nothing else — the decision itself is pure — and
 * the returned finalizer cancels the pending frame when the race below is won
 * by the limit or the widget unmounts.
 */
const awaitQuietFrames = Effect.callback<void>((resume) => {
  if (typeof requestAnimationFrame !== "function") return;

  let gate = makeMountRevealGate();
  let handle = requestAnimationFrame(function tick(frameMillis) {
    gate = observeMountRevealFrame(gate, frameMillis);

    if (isMountRevealSettled(gate)) {
      resume(Effect.void);
      return;
    }

    handle = requestAnimationFrame(tick);
  });

  return Effect.sync(() => cancelAnimationFrame(handle));
});

const mountRevealGateAtom = Atom.make(
  Effect.sleep(revealFloor).pipe(
    Effect.andThen(
      Effect.race(awaitQuietFrames, Effect.sleep(revealSettleLimit))
    )
  )
).pipe(Atom.keepAlive, Atom.withLabel("mountRevealGateAtom"));

/**
 * Whether the mount reveal may start. Latches once per Widget Instance: the
 * registry is recreated on remount, so a remounted widget waits again.
 */
export const mountRevealReadyAtom = Atom.make((get) =>
  AsyncResult.isSuccess(get(mountRevealGateAtom))
).pipe(Atom.keepAlive, Atom.withLabel("mountRevealReadyAtom"));
