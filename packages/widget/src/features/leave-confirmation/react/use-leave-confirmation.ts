import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { useRef, useState } from "react";
import { type Blocker, useBlocker } from "react-router";
import {
  isWidgetPath,
  type WidgetPath,
} from "../../../services/navigation/widget-routes";
import {
  beforeUnloadLeaveGuardAtom,
  leaveGuardedAtom,
} from "../state/leave-guarded";

export type LeaveConfirmationDialogProps = Readonly<{
  readonly onLeave: () => void;
  readonly onStay: () => void;
  readonly open: boolean;
}>;

type HeldLeave = Readonly<{ readonly leave: () => void }>;

/** A leave action held until the user answers, while one needs asking. */
const useHeldLeave = () => {
  const guarded = useAtomValue(leaveGuardedAtom);
  const [held, setHeld] = useState<HeldLeave | null>(null);
  // Once nothing is guarded the question no longer applies; the user acts again.
  if (!guarded && held) setHeld(null);

  return {
    /** Runs `leave` at once when nothing is guarded; otherwise asks first. */
    confirm: (leave: () => void) => {
      if (guarded) setHeld({ leave });
      else leave();
    },
    guarded,
    held,
    release: () => setHeld(null),
  };
};

/**
 * Asks for a Leave Confirmation before a user action, such as a wallet
 * disconnect or switch, would end a leave-guarded Execution.
 */
export const useLeaveConfirmation = () => {
  const { confirm, held, release } = useHeldLeave();

  return {
    confirm,
    dialog: {
      onLeave: () => {
        release();
        held?.leave();
      },
      onStay: release,
      open: held !== null,
    } satisfies LeaveConfirmationDialogProps,
    /** A held action waits for the user's answer. */
    pending: held !== null,
  };
};

/**
 * Steps' Leave Confirmation: asks before any navigation away from Steps, and
 * before the page unloads, while its Execution is leave-guarded. Moving on to
 * `completePath` never asks. `confirm` asks before Steps' own exit, so
 * leaving asks once.
 */
export const useExecutionLeaveConfirmation = (completePath: WidgetPath) => {
  const { confirm, guarded, held, release } = useHeldLeave();
  useAtomMount(beforeUnloadLeaveGuardAtom);
  // Once the user chose to leave, this page never holds a navigation again,
  // even while it still animates out.
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      guarded &&
      !leaving.current &&
      nextLocation.pathname !== currentLocation.pathname &&
      !isWidgetPath(nextLocation.pathname, completePath)
  );
  // Each blocked attempt is a new Blocker; the same history entry is not.
  const heldNavigation = blocker.state === "blocked" ? blocker : null;
  // A navigation held while work was under way that no longer needs asking is
  // dropped, not asked again; the router clears it on the next navigation.
  const [droppedNavigation, setDroppedNavigation] = useState<Blocker | null>(
    null
  );
  if (!guarded && heldNavigation && heldNavigation !== droppedNavigation) {
    setDroppedNavigation(heldNavigation);
  }
  const asking =
    heldNavigation !== null && heldNavigation !== droppedNavigation;

  return {
    confirm,
    dialog: {
      onLeave: () => {
        leaving.current = true;
        release();
        if (asking) blocker.proceed?.();
        else held?.leave();
      },
      onStay: () => {
        release();
        if (asking) blocker.reset?.();
      },
      // Both questions are cleared during render once nothing is guarded.
      open: asking || held !== null,
    } satisfies LeaveConfirmationDialogProps,
  };
};
