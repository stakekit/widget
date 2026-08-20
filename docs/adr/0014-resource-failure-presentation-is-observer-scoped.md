---
status: accepted
---

# Resource failure presentation is observer scoped

Authoritative Resources cache presentation-neutral typed failures. Each
published root resource exposes `local` and `foreground` views over the same
private canonical Atom: `local` observes the fact without global presentation,
while `foreground` may present validated rich server detail. Both views share
the canonical request identity, cache, retry, freshness, invalidation, and
typed result.

`ApiRequestError` retains a validated `richError` value when one is available.
API capabilities normalize this evidence once at the Effect request boundary.
Resource capabilities do not publish it; their foreground observers decide
whether to present a request failure. Operation capabilities present request
failures immediately through a shared Effect combinator because mutations and
transient workflow calls are not Authoritative Resources. The common HTTP
transport observes geo-block responses but does not present rich errors.

Foreground presentation is deduplicated by `ApiRequestError` object identity
within one Application Runtime Generation. Concurrent observers and remounts
therefore present one cached failure occurrence, while a retry that produces a
new request error may present again. Local and foreground observation order
does not affect acquisition or presentation eligibility.

This decision clarifies ADR-0008 rather than replacing it. ADR-0008 continues
to define one canonical remote fact and resource-owned execution policy; this
ADR defines the separate observer seam between a cached typed failure and
global presentation.

## Rejected alternatives

- Publish rich errors in every read transport, because the first cache filler
  would decide presentation for all later consumers.
- Add a caller-supplied suppression option to resource requests, because
  presentation mode would leak into canonical identity and execution policy.
- Maintain separate local and foreground resource Atoms, because that would
  duplicate caches and allow freshness or retry behavior to diverge.
- Queue rich errors, because the existing single-modal latest-error behavior is
  sufficient and a queue would broaden this change.
