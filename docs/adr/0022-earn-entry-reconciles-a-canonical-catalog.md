---
status: accepted
---

# Earn Entry reconciles a canonical non-paginated catalog

Earn keeps one route-scoped Entry Intent containing opportunity selection and
entry-form values. Direct semantic transitions update that intent, while one
pure Earn Selection Reconciliation uses the previous view, one-time
initialization seed, live preferences, and current authoritative facts without
writing derived choices back into intent.

Token discovery uses the Legacy API's non-paginated, project-enabled token
response filtered by network, enter availability, and dashboard category. The
Dashboard reads configured categories concurrently and derives availability
from their usable non-empty results; Classic reads the ungrouped catalog.
Wallet balances only enrich canonical tokens, and the first token selection
waits for both catalog discovery and the first balance attempt so its initial
default is stable. Initialization and preferences may select from the Earn
Catalog but never expand it.

Earn publishes focused loading facts and one Blocking Earn Failure rather than
a staged machine status, failure stage, retry target, or manual retry command.
A refresh that retains usable data remains ready. Token pagination and its
Yield API resource path are removed; validator search and pagination remain.
Positions affect entry constraints but no longer choose the default yield.

Earn Initialization is consumed when its seed is captured after Wallet
Bootstrap settles, before remote resolution completes. The seed may wait for
the Earn Catalog, but route release, Wallet Scope Owner change, or explicit
selection abandons it without replay during the Widget Instance. Entry Intent
remains transient and `TransactionWorkflowStarted` continues to consume it as
specified by ADR-0018.

This supersedes ADR-0009's stage-specific status and retry interface, token
pagination, supplemental preference enrichment, derived-selection commits,
terminal-result initialization consumption, and rule that user commands do not
abandon initialization. It also supersedes ADR-0011's statement that those
ADR-0009 decisions remain in force and ADR-0017's Earn-specific requirement to
preserve staged token pagination and exact retry routing. ADR-0011's narrow
feature-facade interface and ADR-0017's general Atom command and resource
ownership rules remain accepted.
