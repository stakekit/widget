# Classic Transaction Flow architecture

Classic Transaction Flow is one deep module with two internal tiers:

- Application logic lives below `transaction-flow/` outside `react/` and `ui/`. The pure model belongs in `model/`; Effect Atom state, commands, resources, and the facade belong in `state/`, `resources/`, or `runtime/`.
- React view adapters live in `react/` and `ui/`. They render Atom-derived views, normalize UI input, and synchronously dispatch Atom commands.

Application-logic modules must not import React, React DOM, Effect Atom React bindings, or React Query. Their public interface may expose read-only view Atoms and writable command Atoms while keeping mutable storage private. React convenience hooks are zero-logic adapters over that interface.

View adapters may use synchronous local React state only for presentation details with no domain meaning, asynchronous behavior, persistence, route lifetime, or cross-view coordination. They must not declare asynchronous functions, await or chain Promises, discard calls with `void`, execute Effect runtimes, or use React Query. React lifecycle hooks require a named external-boundary review rather than a local exception.

`pnpm lint:architecture` enforces these rules with syntax checks and a type-aware Promise ownership pass. Promise-returning view functions, event handlers, returned work, and floating work fail even without `async` syntax. Only a binding returned by `useNavigate` imported from React Router is accepted as a router adapter by that pass; a coincidentally named function is not. Navigation decisions still belong to Atom outcomes and the route adapter.

The document-claim callback-ref bridge in `app/embedding/widget-instance-react-boundary.tsx` is the only reviewed external React boundary for this effort. Its exact reviewed implementation is also hash-protected because the actual owner `Document` is available only at the React-owned DOM mount seam. Changing it requires a new boundary review; its hash is not a routine snapshot.
