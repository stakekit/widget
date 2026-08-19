# Earn feature architecture

Earn owns one route-scoped Entry Intent containing every user-authored value
needed to resolve an Earn Selection and begin a Yield Entry: category, token,
yield, validators, amount mode and value, provider, and additional mechanic
arguments. Wallet Scope Owner changes discard the intent, while
additional-address-only changes preserve it and re-key their authoritative
reads. `TransactionWorkflowStarted` continues to consume matching owner intent
through the feature-owned projection defined by ADR-0018.

Intent commands invoke focused pure transitions instead of a generic tagged
action dispatcher. A parent transition clears only its dependent intent:
category clears token and yield-scoped values, token clears yield-scoped values,
and yield clears validators and entry-form values owned by that yield. Resource
observations never write derived defaults or repairs into intent.

## Initialization and reconciliation

One Application Runtime Generation marker records whether Earn Initialization
was consumed. After Wallet Bootstrap settles, the first mounted Earn entry
surface captures relevant host or deep-link parameters into a route-local seed
and immediately marks initialization consumed. The seed may wait for remote
facts, but route release, Wallet Scope Owner change, or explicit selection
abandons it without replay. A later Widget Instance begins with a fresh marker.

Earn Selection Reconciliation is a pure previous-view projection. At each
selection level it prefers explicit user intent, the active initialization
seed, a previous resolved value that remains valid for the same owner and
compatible parents, current live host preferences, and finally the ordinary
default. Explicit identifiers remain intent when temporarily unavailable and
become selected again if they return. While Wallet State is unresolved, the
previous selection may remain visible but is ineligible; a confirmed owner
change invalidates it.

Provider, Tron resource, validator, and other advertised option values follow
the same preservation rule. Manual amount text remains user intent even when
constraints make it invalid, while force-max amount is derived from the current
known balance. Positions participate only in entry constraints and submission
eligibility; they do not choose the default yield.

## Earn Catalog resources

The Earn Token Catalog is an Authoritative Resource keyed by network and
Dashboard category. Its Legacy API adapter always requests enterable,
project-enabled options and privately maps a category to backend yield types.
After the backend token-filter change is merged, generated Legacy API clients
are regenerated from its OpenAPI specification; production has no old-contract
fallback or second token-source adapter.

Dashboard Earn observes one non-paginated token catalog resource for each
configured category concurrently. Initial category selection waits for all
category requests to settle and derives available categories from usable,
non-empty results. A failed category is omitted when another category is usable;
the absence of usable data from every required category is a Blocking Earn
Failure. Classic Earn observes one ungrouped catalog resource.

The first token selection waits for the token catalog and first wallet-balance
attempt. Known positive balances rank before ordinary catalog order. A balance
failure settles that attempt without blocking catalog browsing: canonical token
amounts remain unknown, and amount-dependent Yield Entry stays ineligible. A
later balance refresh may update option amounts, while reconciliation preserves
the previous token as long as it remains valid.

An initialization token or yield and a preferred token or yield may select only
from the Earn Catalog. Category-scoped token results already publish their
available Yield identities, so initialization does not use a separate Yield
lookup to inject options. Token discovery has no pagination, pull key, load-more
command, or `tokensForEnabledYieldsOnly` behavior. That Host Configuration field
remains deprecated only at the public compatibility seam until removal.

Selected-token Yield options, Wallet Scope positions, and required Validators
remain staged Authoritative Resource reads. Validator search and pagination
remain resource-owned, and explicit validator intent stores normalized
snapshots so search or pagination cannot make a selected Validator disappear.

## Presentation and failures

Earn does not publish a machine status union. Focused views publish only the
loading and pagination facts their presentation consumes. Initial page
presentation waits for stable category, token-catalog, and first-balance
resolution; Yield, position, Validator, and entry views then publish their own
loading facts.

A required current-path resource that fails without usable data produces one
generic Blocking Earn Failure. Successful empty tokens, Yields, or Validators
are empty catalog states rather than failures. A refresh failure that retains a
usable value remains ready, and failures in unselected categories or balance
enrichment do not block the usable Earn Catalog. Earn publishes no failure
stage, retry target, or manual retry command; route remount or Widget Instance
reload provides recovery.

## Interface and tests

The root `index.ts` publishes only collaborators used outside Earn. React
adapters keep the existing focused hooks, while their private implementation is
split into Token Selection, Yield Selection, Validator Selection, Yield Entry,
and Page Status modules. No private runtime file republishes their Atom
identities. React renders focused views and dispatches semantic commands; it
does not interpret catalog keys or resource failures.

Yield Summary owns yield-detail formatting and the reusable yield-detail
header. Earn consumes those interfaces for its dashboard page and does not
republish them for Position Details.

Tests cross the same feature interface. They cover one-time initialization,
Wallet Scope Owner changes, previous-view reconciliation, direct transition
resets, stable initial token selection, generic loading and failure behavior,
entry constraints, and Validator search and selection. Tests for the deleted
generic reducer, retry routing, token pull pagination, and private catalog
helpers are removed rather than preserved behind new seams.
