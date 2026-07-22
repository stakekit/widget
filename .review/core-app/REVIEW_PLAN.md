# Core application logic review

## Goal

Review the current branch as a coherent application and identify concrete logic,
state-management, lifecycle, and flow bugs. The review is primarily behavioral:
understand how each end-to-end flow works on `main`, understand how the same flow
works on the current branch, and compare their observable behavior and required
state invariants.

This is not a review of individual commits, migration steps, naming, formatting,
or architectural taste. Architectural concerns are findings only when they create
a concrete correctness, lifecycle, isolation, or maintainability defect with a
realistic failure sequence.

## Sources of truth

1. The complete implementation and observable behavior on `main` is the
   regression baseline.
2. The complete implementation on the current branch is the review target.
3. Public package behavior and integration examples may clarify externally
   observable contracts when the two implementations are ambiguous.

Do not use OpenSpec artifacts or commit history to establish intended behavior.
Existing tests are incomplete and may be stale. They may be used to learn how to
exercise a flow, detect regressions, or verify a finding, but their assertions
are not authoritative specifications.

Use `git diff` only as a navigation aid for locating moved, removed, or replaced
code. Do not review the branch commit-by-commit or treat each changed hunk as the
unit of review.

`main` is a regression baseline, not proof that behavior is correct. Report a
current-branch logic bug even if there is no direct divergence from `main`, but
clearly distinguish an invariant-based defect from a demonstrated regression.

## Review method

For each owned flow:

1. Map the entry points, routes, state owners, service boundaries, persistence,
   and external inputs on `main` and on the current branch.
2. Trace the happy path end to end on both implementations.
3. Trace disruptive transitions and boundary conditions:
   - wallet connection and disconnection;
   - account, address, or chain changes;
   - route exit, back navigation, deep links, and direct route entry;
   - host configuration and initialization changes;
   - overlapping requests and out-of-order async completion;
   - transaction rejection, cancellation, retry, partial completion, and resume;
   - component unmount and widget remount;
   - resource invalidation and refresh after successful mutations;
   - stale selection, workflow, or cached state crossing between identities.
4. State the behavioral invariants that should remain true and verify whether
   the current implementation preserves them.
5. Follow state through UI adapters, atoms, services, workflow execution, and
   resource refresh. Do not stop at a single folder boundary.
6. Reproduce credible issues with a focused test, command, or fully specified
   execution sequence where practical.

The initial review pass is read-only. Do not modify production code or tests.

## Review lanes

### Application lifecycle and navigation

Runtime creation and disposal, provider composition, configuration and root
inputs, routing, route guards, initial tabs, deep links, wallet/account/chain
transitions, and widget unmount/remount behavior.

### Earn and stake

Earn catalog and selection resolution, token/yield/validator state, form and
amount validation, stake request creation, review, execution steps, completion,
retry/cancellation, and post-transaction refresh.

### Portfolio, position details, and activity

Portfolio resources and summaries, position selection/details, unstake and
pending-action creation, activity selection and reconstruction, execution,
navigation, and resource invalidation after mutations.

### Borrow and horizontal state architecture

Borrow form, market/position identity, wallet projection, action creation,
review/execution/completion, resource refresh, plus shared atom identity and
keys, service lifetimes, workflow isolation, cancellation, and transaction
runtime behavior used across features.

Reviewers own their end-to-end lane but should inspect shared dependencies when
needed. Cross-lane concerns should be reported rather than silently assumed to
belong to another reviewer.

## Finding standard

Only report actionable correctness findings. Each finding must include:

- severity and confidence;
- user-visible or integration impact;
- preconditions;
- the exact state/event sequence that triggers the issue;
- expected behavior, identified as either `main` behavior or an explicit
  correctness invariant;
- current-branch behavior;
- precise file and line references;
- reproduction evidence or a concrete proposed regression test;
- why the behavior is not merely an intentional implementation difference.

Keep unverified suspicions, ambiguities, and follow-up questions separate from
confirmed findings. Do not inflate the report with style feedback, broad praise,
or descriptions of code that is working correctly.

## Coordination

Each reviewer returns findings independently to the coordinating reviewer and
does not edit a shared findings file. The coordinator deduplicates cross-lane
findings, validates high-severity claims, and produces the final prioritized
report. No fixes are made until the review report is agreed upon.
