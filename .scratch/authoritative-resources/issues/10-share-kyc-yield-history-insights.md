# 10 — Share KYC and Yield history insights

**What to build:** Make KYC status, reward-rate history, and TVL history named authoritative resources with complete identity and consistent freshness across classic and dashboard consumers.

**Blocked by:** 03 — Share Yield opportunity and provider facts.

**Status:** implemented

- [x] KYC identity includes Yield and wallet address and cannot reuse status across owners.
- [x] Reward-rate and TVL histories include Yield, period, and interval in their resource identities.
- [x] Each resource owns typed failures, freshness, retry, interruption, and stale-result behavior.
- [x] History sorting and chart formatting remain feature projections rather than cached feature models.
- [x] Existing KYC gates and insight displays retain their behavior.
- [x] Former insight fetch owners are removed.
- [x] Contract, dashboard and classic integration, adapter, lint, and type-check validation pass.
