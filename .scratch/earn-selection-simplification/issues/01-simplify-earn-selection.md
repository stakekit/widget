# 01 — Simplify Earn Selection around the canonical Earn Catalog

**What to build:** Replace the current staged Earn state machine with the
intent, canonical-resource, pure-reconciliation, and focused-transition model
defined by ADR-0022 and the Earn feature architecture. Deliver this as one
vertical refactor without an intermediate dual token-source architecture.

**Blocked by:** Merge the backend `feat/yield-token-filters` changes from
`/Users/petartodorovic/Developer/stakekit-monorepo`, then regenerate the Widget's
legacy generated client from the updated backend contract. Do not manually edit
generated client files.

**Status:** ready-for-agent

## Authoritative references

- [Effort spec](../spec.md)
- [ADR-0022](../../../docs/adr/0022-earn-entry-reconciles-a-canonical-catalog.md)
- [Earn feature architecture](../../../packages/widget/src/features/earn/ARCHITECTURE.md)
- [Domain vocabulary](../../../CONTEXT.md)

If this ticket conflicts with those documents, the ADR and feature architecture
win. Keep ADR-0018's owner-scoped `TransactionWorkflowStarted` reset behavior.

## Implementation checklist

- [ ] Regenerate the legacy API client and verify the token endpoint exposes the
      backend filters needed by the canonical Earn Catalog.
- [ ] Add a non-paginated Earn Catalog resource keyed by network and category;
      encapsulate `enter: true` and category-to-yield-type filtering.
- [ ] Fetch dashboard categories concurrently and fetch one ungrouped catalog in
      Classic. Remove token Pull and load-more behavior while retaining validator
      pagination and search.
- [ ] Replace the staged machine, generic action reducer, retry targets, failure
      stages, and operation tags with `EarnEntryIntent`, `EarnSelection`,
      `EarnSelectionView`, direct pure transitions, and focused loading facts.
- [ ] Reconcile projections using explicit intent, the active one-shot init seed,
      a still-valid previous view, live host preferences, and ordinary defaults
      in that order.
- [ ] Consume initialization once per Widget Instance after Wallet Bootstrap
      settles. Allow its first application to wait for catalog and balance
      settlement; abandon it on route release, owner change, or explicit user
      selection without replay.
- [ ] Wait for the first balance attempt before deriving the initial token.
      Treat balance failure as settled enrichment: keep browsing available,
      expose unknown amount, and disable amount-dependent submission.
- [ ] Remove positions from default yield choice while retaining them for entry
      constraints, force-max behavior, and submission.
- [ ] Preserve all Yield Entry form state in this feature and reconcile provider,
      Tron resource, validators, amount, and descendant selections as specified.
- [ ] Deprecate `tokensForEnabledYieldsOnly` at the public host boundary for one
      compatibility release and remove its normalized/internal behavior.
- [ ] Remove the separate init-yield lookup and resolve initialization through
      canonical catalog results and the normal selected-yield resource.
- [ ] Publish one generic blocking failure only when a required current-path
      resource has no usable data. Do not expose manual retry from Earn.
- [ ] Delete obsolete reducer, retry, token-pagination, and internal-helper tests;
      replace them with behavior tests through the feature interface.
- [ ] Update documentation if implementation reveals a genuine contract change;
      do not silently diverge from ADR-0022.

## Acceptance criteria

- [ ] Classic and Dashboard derive only project-enabled, enterable options from
      the canonical Earn Catalog.
- [ ] Initial selection does not jump after first render because catalog and the
      first balance attempt settle before the initial token is chosen.
- [ ] A still-valid explicit or previous selection survives resource refreshes;
      invalid descendants are reconciled deterministically.
- [ ] Init parameters are attempted at most once in a Widget Instance, including
      across Earn route remounts.
- [ ] Partial dashboard-category failures omit unavailable categories when usable
      categories remain; all-empty results render empty; required-path failure
      without usable data renders the generic failure.
- [ ] Balance failure does not block browsing, while amount-dependent submission
      remains ineligible until an amount is known.
- [ ] No user-visible retry, token pagination, positions-based default yield,
      supplemental token directory, or dual token-source compatibility path
      remains.
- [ ] Existing public package and bundled-renderer compatibility is preserved,
      apart from the documented deprecation.

## Verification

- [ ] `mise exec -- pnpm --filter @stakekit/widget lint`
- [ ] `mise exec -- pnpm --filter @stakekit/widget test:changed:all`
- [ ] `mise exec -- pnpm check-hygiene`
- [ ] `mise exec -- pnpm --filter @stakekit/widget build`
- [ ] Run the root `mise exec -- pnpm check` before handoff if the final change is
      broad enough to affect multiple workspaces.

## Comments

