# 03 — Establish the Effect and Atom application boundary

**What to build:** Establish React-as-view-layer as the documented design boundary for the Classic Flow effort and future materially refactored code. Application logic must live in deterministic functions, Effect, and Effect Atom, with React limited to rendering, synchronous intent dispatch, presentation-only local state, and explicitly named external boundaries.

**Blocked by:** 02 — Remove unsupported multi-instance wallet concurrency.

**Status:** ready-for-agent

- [ ] Application-logic modules, including the future Classic Flow core and facade, do not import React.
- [ ] Touched view adapters do not use `useEffect` unless the use is isolated in an explicitly named and reviewed external boundary.
- [ ] The document-claim embedding bridge remains only if scoped Effect and Atom lifecycle cannot safely express the React mount contract.
- [ ] The rules permit local synchronous presentation state only when it has no domain meaning, asynchronous behavior, persistence, route lifetime, or cross-component coordination.
- [ ] React event handlers are constrained to normalizing UI input and synchronously dispatching Atom commands; Effect execution and Promise awaiting are not permitted there.
- [ ] Feature facades may expose read-only view Atoms, writable command Atoms, and zero-logic React convenience hooks while keeping mutable storage private.
- [ ] Existing unrelated React effects and React Query usage remain outside this effort's touched scope.
- [ ] The accepted architecture decision and agent guidance remain aligned with the implementation.
