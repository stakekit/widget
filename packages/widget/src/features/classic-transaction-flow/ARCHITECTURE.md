# Classic Transaction Flow architecture

Classic Transaction Flow is one deep module with two internal tiers:

- Application logic lives below `classic-transaction-flow/` outside `react/` and `ui/`. The pure model belongs in `model/`; Effect Atom state, commands, resources, and the facade belong in `state/`, `resources/`, or `runtime/`.
- React view adapters live in `react/` and `ui/`. They render Atom-derived views, normalize UI input, and synchronously dispatch Atom commands.

Application-logic modules must not import React, React DOM, Effect Atom React bindings, or React Query. Their public interface may expose read-only view Atoms and writable command Atoms while keeping mutable storage private. React convenience hooks are zero-logic adapters over that interface.

The only Classic Flow state outside its route tree is the application-runtime intake store. Every Start creates a fresh monotonic runtime-local epoch and an immutable intake snapshot. The epoch is used only to remount the capture-once Session provider, target intake-store cleanup, and suppress stale shared-world outputs such as routing and tracking; it is not a domain identity or descendant command input.

The published headless interface exposes one Start command with closed semantic
route mounts, an active-path observation, and a Dashboard Activity Resume view
with a bound abandonment command. It does not expose the intake store, Flow
Session values, epochs, captured intake, or destinations. Start, abandonment,
and scoped finish commands own their navigation and validate private ownership
before publishing shared output.

A stable route tree spanning Review, Steps, and Complete mounts one non-`keepAlive` Session module. Session, Review, and Execution expose separate narrow scoped capabilities rather than one combined nullable context. The Session owns only immutable intake and a private nullable execution-action handoff. Every Review mount creates a fresh scope that owns Action Preview and forward navigation; every Execution mount captures the handoff and reads the Transaction Workflow scoped Atom for the whole Steps-and-Complete scope. Workflow view and command Atoms are passive capabilities of that scope and cannot extend or revive its private lifecycle.

The module must not reintroduce a Classic Flow domain identity, Reviewing/Executable phase state, an identity-keyed Transaction Workflow handoff, or a second preparation state machine. Continue promotes the reviewed Action Preview into the Session handoff. Entering any later Review scope is the sole operation that clears the handoff, so widget Back, browser Back, and host routing share the same behavior. Activity Resume reconstructs a fresh preview when possible and never seeds Execution directly from its historical action.

View adapters may use synchronous local React state only for presentation details with no domain meaning, asynchronous behavior, persistence, route lifetime, or cross-view coordination. They must not declare asynchronous functions, await or chain Promises, discard calls with `void`, execute Effect runtimes, or use React Query. React lifecycle hooks require a named external-boundary review rather than a local exception.

Navigation decisions belong to scoped Atom commands and workflow transition events. After confirming current Flow Session or Execution Attempt ownership, they execute canonical absolute destinations through the application-runtime `WidgetNavigation` module; derived view Atoms do not publish navigation outcomes for React to apply. Declarative route guards remain React view concerns.

The document-claim callback-ref bridge in `app/embedding/widget-instance-react-boundary.tsx` is the only reviewed external React boundary for this effort because the actual owner `Document` is available only at the React-owned DOM mount seam. Changing its lifecycle responsibilities requires a new boundary review.
