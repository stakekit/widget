import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { TransactionWorkflowService } from "../../../services/transaction-workflow/transaction-workflow-service";

const leaveGuardedResultAtom = walletRuntime
  .atom(
    TransactionWorkflowService.use((workflows) =>
      Effect.succeed(workflows.leaveGuarded)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.withLabel("leaveGuardedResult"));

/** Whether leaving now would abandon a live Execution's work under way. */
export const leaveGuardedAtom = Atom.make((get) =>
  Option.getOrElse(AsyncResult.value(get(leaveGuardedResultAtom)), () => false)
).pipe(Atom.withLabel("leaveGuarded"));

/**
 * While mounted, has the browser ask before the page unloads whenever an
 * Execution is leave-guarded. The listener lives as long as that answer.
 */
export const beforeUnloadLeaveGuardAtom = Atom.make((get) => {
  if (!get(leaveGuardedAtom)) return;
  const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
  globalThis.window?.addEventListener("beforeunload", onBeforeUnload);
  get.addFinalizer(() =>
    globalThis.window?.removeEventListener("beforeunload", onBeforeUnload)
  );
}).pipe(Atom.withLabel("beforeUnloadLeaveGuard"));
