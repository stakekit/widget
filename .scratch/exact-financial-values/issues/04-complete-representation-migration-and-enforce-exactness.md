# 04 — Complete representation migration and enforce exactness

**Parent:** [Preserve exact financial values through execution](../spec.md)

**What to build:** Finish the app-wide migration by separating exact financial values from display-only numbers in Portfolio, Position Details, Yield Summary, and shared representation. Remove legacy conversion paths and enable repository checks that prevent exact values from drifting back to JavaScript numbers.

**Blocked by:** 02 — Preserve exact values through Earn and Classic Transaction Flows; 03 — Preserve exact values throughout Borrow.

**Status:** ready-for-agent

- [ ] Portfolio, Position Details, Yield Summary, health, gas, price, and remaining application financial calculations consume canonical BigNumber values.
- [ ] Shared semantic formatters cover token quantities, available and minimum amounts, fiat values, percentages, and compact metrics with explicit locale and display policies.
- [ ] Formatting and public serialization remain separate; public and persisted exact values use locale-independent strings.
- [ ] `.toNumber()` is confined to explicit terminal representation and chart adapters.
- [ ] Display-only percentages and chart points remain numbers and cannot become Entry Intent, eligibility, Action Command, persistence, or transaction inputs.
- [ ] Review and Complete surfaces across Classic and Borrow journeys represent their exact submitted or executed amounts consistently.
- [ ] Direct BigNumber construction is replaced by finance-owned constructors outside the finance owner; type-only use of the canonical exact type remains possible.
- [ ] Obsolete finite-number financial schemas and compatibility paths are removed after every consumer has migrated.
- [ ] Repository AST checks reject finite-number schemas in known financial models, direct exact-value construction outside finance ownership, and non-representation `.toNumber()` calls.
- [ ] Guardrail fixtures prove intended violations fail and approved presentation and chart adapters pass.
- [x] An app-wide audit classifies remaining numeric fields and confirms that only counts, indexes, chain IDs, non-financial enumerations, percentages, and chart points remain numbers. See [numeric-field-audit.md](../numeric-field-audit.md).
- [ ] Representation tests use exact values that cannot safely pass through JavaScript number and assert correct locale-aware output.
- [ ] Public package and bundled entrypoints remain compatible.
- [ ] Widget lint, focused representation and portfolio tests, root hygiene, and the full repository check pass with no temporary guardrail suppressions.
