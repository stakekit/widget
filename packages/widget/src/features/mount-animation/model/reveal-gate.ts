/**
 * Decides, from frame pacing alone, whether the main thread is serving frames
 * again after the mount commit. The mount reveal is a height animation, so its
 * first frames are the ones a starved main thread ruins; starting it while the
 * commit tail is still running costs several frames no matter how cheap that
 * tail becomes.
 */

/**
 * A frame slower than a 60Hz vsync interval plus jitter absorbed work rather
 * than merely waiting for the display. Faster displays are judged by the same
 * absolute budget on purpose: an estimator seeded from live samples can be
 * poisoned by a single spurious gap, and every stall worth avoiding here is far
 * longer than this.
 */
const quietFrameMillis = 20;

/** Consecutive quiet frames that count as the main thread having settled. */
const quietFrameCount = 3;

type MountRevealGate = {
  readonly lastFrameMillis: number | null;
  readonly quietFrames: number;
};

export const makeMountRevealGate = (): MountRevealGate => ({
  lastFrameMillis: null,
  quietFrames: 0,
});

export const isMountRevealSettled = (gate: MountRevealGate) =>
  gate.quietFrames >= quietFrameCount;

export const observeMountRevealFrame = (
  gate: MountRevealGate,
  frameMillis: number
): MountRevealGate => {
  // The first frame only establishes a baseline: one timestamp says nothing
  // about pacing.
  if (gate.lastFrameMillis === null) {
    return { lastFrameMillis: frameMillis, quietFrames: 0 };
  }

  const quiet = frameMillis - gate.lastFrameMillis <= quietFrameMillis;

  return {
    lastFrameMillis: frameMillis,
    quietFrames: quiet ? gate.quietFrames + 1 : 0,
  };
};
