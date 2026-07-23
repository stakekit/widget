---
status: accepted
---

# Earn state resolves selection and readiness

Earn exposes one Atom-owned application-state boundary that resolves Earn Selection, Earn Readiness, capabilities, and stage-specific failure from user intent plus Authoritative Resources. React renders that contract and dispatches synchronous commands; it does not infer loading, empty, or failure semantics from individual resources. This applies ADR-0004's application-logic ownership while preserving ADR-0008's rule that canonical remote reads, caching, pagination, refresh, and stale-result suppression remain owned by Authoritative Resources.

The resolver reads Authoritative Resources lazily in dependency order, while starting independent initialization and positions reads together. Each resource `AsyncResult` is normalized once into an unavailable, failed, or usable observation; a usable observation retains whether a same-key refresh is waiting. The published view exposes normalized token, yield, and positions snapshots plus only the operational pagination atoms React needs. A blocking failure carries its exact retry target atom, so retry routing does not reconstruct resource identity outside the resolver.

The `EarnYield` response schema owns Earn Mechanic Argument projection and validation. It first decodes every field through the generated API schema, then resolves the typed API field array into a name-keyed domain record containing only the six arguments the Widget consumes: amount, provider ID, Tron resource, validator address, validator addresses, and subnet ID. Consumed fields also validate the canonical name-to-type variants produced by the Yield API: amount, provider ID, validator address, and validator addresses are strings; Tron resource is an enum; and subnet ID is a number. Amount decoding preserves the complete `-1/-1` force-max pair but normalizes a `-1` maximum paired with a non-negative minimum to an unbounded maximum. The domain projection drops wire-only metadata such as `name`, `type`, and labels, retaining only required flags, amount bounds, and options consumed by the Widget. The Widget trusts the API contract to provide unique argument names. Valid unconsumed API fields are projected away; malformed API fields or invalid consumed domain values are response-decode failures, so tolerant directory responses omit only that yield while a direct opportunity request follows ordinary resource-failure handling. Earn state consumes this typed model and does not carry or retry a separate form-contract failure.

The machine distinguishes first acquisition from later refresh. A required first acquisition without a usable value blocks readiness and exposes one structured, stage-specific failure with a targeted retry command. A later refresh retains the last successful selection and readiness, exposes its failure non-blockingly through the responsible resource, and does not enter the blocking failure state. Successful authoritative results reconcile and commit invalid selections so removed data cannot later cause a hidden intent to snap back.

Optional preference enrichment is not a required acquisition: preferred-token discovery reads the complete Legacy token directory, treats an unavailable directory result as a missing preference candidate, and leaves the Authoritative Resource's error semantics unchanged. All actual token candidates are still intersected with the active category and API-key-enabled yield scope.

Earn Initialization seeds selection once per Widget Instance and never becomes a permanent fallback. For an account-targeted deep link, committing a resolved selection does not consume initialization until the initial Wallet Scope Owner exists; this lets the required owner reset intent and resolve the target without re-arming it. Later Wallet Scope Owner changes reset Earn intent but do not rerun Earn Initialization, while additional-address-only changes refresh dependent facts without resetting intent. A committed yield ID remains a resource seed while selected so catalog re-keying cannot transiently replace it with a fallback. These lifecycle rules favor deterministic, safe selection over preserving form progress across wallet owners.

The detailed status vocabulary, precedence rules, loading dependencies, form invariants, pagination behavior, and verification matrix are specified in `.scratch/earn-state-machine/spec.md`.

## Considered options

- Let React combine resource loading and failure flags. Rejected because it creates a second, presentation-owned state machine and conflicts with ADR-0004.
- Preserve raw mechanic field arrays and validate selected yields in the resolver. Rejected because invalid remote data would cross the response seam and require a second error contract inside Earn state.
- Treat every resource failure as blocking. Rejected because a failed refresh with a usable prior value should not discard a coherent Earn Selection.
- Keep invalid user intent behind a fallback projection. Rejected because removed options could unexpectedly reappear as the selection after a later refresh.
- Reapply initialization after every wallet-owner change. Rejected because initialization is a Widget Instance input, not a persistent selection preference.
