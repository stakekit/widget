# 10 — Contract legacy intake and verify the atomic cutover

**What to build:** Complete the atomic Classic Flow cutover by deleting every superseded transaction-intake authority and proving that supported embedding, routing, wallet, review, execution, Effect/Atom ownership, and public API behavior remain coherent as one merge-ready change.

**Blocked by:** 06 — Migrate the Enter journey; 07 — Migrate the Exit and Manage journeys; 08 — Migrate Activity Resume and unified flow lifetime; 09 — Isolate the Transaction Workflow handoff.

**Status:** ready-for-agent

- [ ] Delete the separate Enter, Exit, Manage, and Activity selection state authorities, their setters, action-presence phase encoding, and variant lifecycle atoms and guards.
- [ ] Delete duplicate cross-cutting variant switches for Action preview, review pricing, gas warnings, route validity, and Transaction Workflow handoff.
- [ ] Delete hook-owned asynchronous orchestration, React Query or Promise caching introduced by the legacy Classic paths, and React effects that no longer qualify as named external boundaries.
- [ ] Delete shallow tests for removed atoms, setters, object-identity cleanup, and simultaneous Widget Instance isolation; retain or replace their supported behavior at facade, adapter, browser, and embedding seams.
- [ ] Confirm there is one active Classic Transaction Flow authority with no mirrored writes, compatibility adapter, legacy fallback, or externally writable storage.
- [ ] The final implementation keeps application logic React-free, view handlers synchronous, storage private, resources Effect-backed, cleanup scoped, and external boundaries explicit and reviewed.
- [ ] Representative Enter, Exit, Manage, and Activity Resume browser journeys pass in classic and dashboard routing, including deep links, review, Continue, Back, steps, completion, Wallet Scope redirects, tracking, KYC, warnings, and preserved copy.
- [ ] Embedding tests pass for second-mount rejection, first-instance preservation, bundled rerender/unmount, and sequential remount.
- [ ] Published React and bundled interfaces remain compatible apart from the additive bundled `unmount` operation.
- [ ] Focused unit, DOM, and browser suites pass, followed by widget lint/type checking and relevant hygiene checks.
- [ ] The integration branch is green and ready to land as one atomic Classic Flow migration.
