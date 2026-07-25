# 06 — Complete Earn Yield Entry and remove the aggregate page model

**What to build:** Both Earn variants use Yield Entry and Yield Summary for amount, quote, readiness, CTA, failures, and submission, eliminating the Atom-to-React page-model bridge.

**Blocked by:** 04 — Introduce Yield Entry through position details; 05 — Replace the Earn browsing bridge with capability facades.

**Status:** complete

- [x] Classic and dashboard Earn entry surfaces consume stable feature facades.
- [x] Published view values contain no nested Atoms, Atom factories, or command callbacks.
- [x] The aggregate Earn page model, binding Atom, and bridge hook are deleted.
- [x] Earn initialization, retry, KYC, tracking, and transaction-start behavior remain unchanged.
