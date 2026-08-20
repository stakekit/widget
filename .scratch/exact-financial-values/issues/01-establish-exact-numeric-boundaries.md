# 01 — Establish exact numeric boundaries

**Parent:** [Preserve exact financial values through execution](../spec.md)

**What to build:** Establish the shared exact-value boundary so API string amounts and wallet Base Unit Amounts cannot lose precision before domain decoding or execution. Generated API clients keep Effect's native JSON decoding, and an EVM wallet transaction must preserve a quoted Base Unit Amount beyond JavaScript's safe integer range.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Finance owns canonical BigNumber schemas, constructors, conversions, and explicit division configuration.
- [ ] Financial decimal schemas accept valid API strings and numbers and decode both forms into equal BigNumber values.
- [ ] Base Unit Amount schemas decode valid wire representations into `bigint` and serialize through locale-independent strings where JSON requires them.
- [ ] Generated API clients keep Effect's native response JSON decoding without an `HttpClientResponse` wrapper.
- [ ] API execution values that can exceed JavaScript precision arrive as strings; number fields remain safe integers or non-execution values such as rates and legacy display prices.
- [ ] Success, typed-error, unexpected-status, geoblocking, and rich-error paths retain their existing generated-client behavior.
- [ ] Wallet transaction JSON uses `Schema.fromJsonString`; decimal quantities beyond JavaScript's safe integer range are quoted and chain-specific hex quantities decode in the EVM adapter.
- [ ] BigNumber configuration no longer depends on importing representation formatting code.
- [ ] EVM unsigned transaction decoding preserves `"1000000000000000001"` as an exact Base Unit Amount through wallet-facing request preparation.
- [ ] Counts, indexes, non-financial enumerations, and chain IDs remain safe integer numbers.
- [ ] Focused API, finance-schema, and wallet-driver tests pass, along with Widget lint and root hygiene when the import graph changes.
