# 01 — Enforce one Widget Instance lifecycle

**What to build:** Enforce the supported host behavior of at most one mounted Widget Instance per browser document. A second mount must fail deterministically without disturbing the active widget, while bundled hosts can explicitly unmount and later create a fresh instance.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The public embedding boundary acquires one document-level claim before wallet and application providers initialize.
- [ ] The claim uses a stable document-owned identity that detects conflicts across separately bundled widget copies or versions.
- [ ] A second concurrent mount fails immediately with a deterministic internal error name and message, without warning-only behavior, takeover, degradation, or changes to the active instance.
- [ ] The second-mount error is not added to the published package error surface.
- [ ] The bundled renderer returns additive `rerender` and `unmount` operations; rerender retains the claim and unmount releases it with the widget runtime.
- [ ] Sequential unmount and remount creates a clean Widget Instance and fresh runtime generation.
- [ ] Claim ownership prefers a scoped Effect exposed through Atom lifecycle. Any required React mount bridge is isolated as the named embedding boundary and contains no wallet or feature logic.
- [ ] Contract tests cover first mount, rejected second mount, preservation of the first instance, cross-bundle conflict, rerender, unmount, claim release, and sequential remount.
- [ ] Existing published React and bundled entry contracts remain compatible apart from additive bundled unmounting.
