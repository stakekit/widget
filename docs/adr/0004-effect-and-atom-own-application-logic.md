---
status: accepted
---

# Effect and Atom own application logic

New and materially refactored widget code places business state, transitions, asynchronous orchestration, retries, concurrency, failures, and resource lifetimes in Effect and Effect Atom. React is a view adapter that reads Atom-derived state and dispatches user intent; `useEffect` is reserved for unavoidable React, DOM, router, or third-party lifecycle boundaries that cannot be represented safely as a scoped Effect or lifecycle Atom.

This trades familiar component-local hook orchestration for one testable application-logic boundary with typed failures and scoped cleanup. It does not require unrelated existing React effects to be migrated, but code touched by a feature or refactor must not introduce or preserve React-owned application logic merely for local convenience.

React may still own synchronous presentation state with no domain meaning, asynchronous behavior, persistence, route lifetime, or cross-component coordination, such as focus, hover, temporary disclosure, and element references. Derived domain values, validation, user-intent state, loading and failure state, and coordinated view state remain application logic and belong in Effect Atom.

React may declare that a lifecycle Atom is mounted when a resource genuinely follows view or route visibility, but the Atom or scoped Effect owns acquisition, interruption, and finalization. Resources belonging to the whole Widget Runtime are scoped there rather than indirectly owned by a component mount.

React event handlers are synchronous adapters: they normalize UI input and dispatch an Atom command. They do not run or await Effects, call asynchronous APIs, sequence workflow changes or retries, or clean up domain resources; asynchronous browser operations also belong behind Effect-backed Atom commands.

Deterministic constructors, transitions, invariant checks, and projections remain plain TypeScript rather than being wrapped ceremonially. Effect Atom owns reactive state and commands; Effect owns typed asynchronous work, dependencies, concurrency, failures, and scoped resources.

Feature facades expose read-only view Atoms and writable command Atoms while retaining private mutable storage. React may consume them directly or through zero-logic convenience hooks, but those hooks do not derive business values, branch on domain variants, or orchestrate commands.

Effect-backed resources and command Atoms own loading, typed failure normalization, retry eligibility, and stale-result suppression. React pattern-matches published view state and dispatches Retry rather than catching promises, translating raw exceptions, or inferring asynchronous state with local flags.

Architecture checks enforce the boundary: application-logic modules do not import React, and materially touched view adapters do not use `useEffect`. An unavoidable external lifecycle exception is isolated in a named boundary adapter and explicitly allowlisted rather than becoming precedent for feature orchestration.

The document-level Widget Instance claim prefers scoped Effect ownership exposed through an Atom lifecycle. If safe React mount and unmount semantics require a hook, one isolated embedding-boundary adapter may bridge only claim acquisition and release; it cannot own wallet or feature behavior.

New and materially refactored feature resources use Effect services and resources exposed through Atom rather than React Query, hook-owned fetching, or Promise caches. Existing unrelated React Query usage is not migrated solely because of this decision.

Feature Effects run through the existing scoped application or wallet Atom runtimes and injected Effect services. Feature modules do not construct ad hoc runtimes or call `Effect.runPromise`; runtime generations own interruption and cleanup.

Third-party capabilities prefer headless Effect services. When an API is genuinely React-only, a named boundary adapter normalizes its snapshots and callbacks into Atom; decisions, asynchronous sequencing, error policy, and cleanup beyond the library subscription remain in Effect and Atom.
