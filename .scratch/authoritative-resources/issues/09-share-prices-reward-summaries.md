# 09 — Share prices and reward summaries

**What to build:** Give token prices and per-Yield reward summaries authoritative owners so Earn, Portfolio, and position details share canonical financial facts and bounded backend work.

**Blocked by:** 02 — Share wallet token-balance scans.

**Status:** implemented

- [x] Price request identity is complete and semantically equivalent token requests share one acquisition.
- [x] Empty and duplicate token inputs avoid unnecessary backend work and preserve deterministic result ordering.
- [x] Reward-summary requests canonicalize Yield identities safely, apply bounded concurrency, and represent missing summaries explicitly.
- [x] Feature totals and formatted values remain downstream projections over canonical facts.
- [x] Typed transport, decode, partial, and invariant failures do not leak raw adapter errors.
- [x] Former price and reward fetch owners are removed.
- [x] Contract, feature integration, adapter, lint, and type-check validation pass.
