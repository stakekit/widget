# 04 — Establish the pure Classic Flow core

**What to build:** Create a deterministic Classic Transaction Flow model that makes intake identity, variants, phases, replacement, abandonment, and projections explicit without depending on React, Atom storage, browser globals, clocks, randomness, or asynchronous execution.

**Blocked by:** 03 — Enforce the Effect and Atom application boundary.

**Status:** ready-for-agent

- [ ] The model is one tagged union with Enter, Exit, Manage, and Activity Resume variants rather than nullable variant fields.
- [ ] A branded Classic Transaction Flow Identity is injected when a flow starts; the core does not generate identity or read time.
- [ ] Starting Enter, Exit, or Manage creates a Reviewing flow with immutable intake facts; Activity Resume creates an Executable flow with its existing Yield Action.
- [ ] Starting a flow atomically replaces the previous active flow.
- [ ] A targeted Reviewing flow can attach one Yield Action exactly once and transition one-way to Executable.
- [ ] Attachment enforces active identity, phase, and exactly-once invariants without adding cross-field Yield Action content validation.
- [ ] Stale transition attempts return a typed stale-flow result; stale targeted abandonment is an idempotent no-op; other invariant failures leave state unchanged.
- [ ] Pure projections cover Action-preview input, review-pricing input, gas-warning input, Wallet Scope validity, narrow variant snapshots, and Executable Transaction Workflow handoff.
- [ ] Wallet Scope owner comparison remains network plus primary address, with case-insensitive EVM addresses and no invalidation for additional-address-only changes.
- [ ] Table-driven tests cover every variant, transition, replacement, stale case, immutable fact, Back identity rule, and deterministic projection without mounting React.
