# 07 — Contract legacy hooks and verify the final architecture

**What to build:** Every migrated journey uses the new facades directly, obsolete compatibility surfaces are removed, and architecture checks prove that React remains a thin view layer.

**Blocked by:** 02 — Move Classic and Borrow workflow navigation into atoms; 06 — Complete Earn Yield Entry and remove the aggregate page model.

**Status:** complete

- [x] Remaining legacy consumers migrate and obsolete hooks and compatibility adapters are deleted.
- [x] Application-logic modules do not import React and touched view adapters do not synchronize domain state with effects.
- [x] Static checks reject nested public Atoms and React-owned application navigation bridges.
- [x] Focused seam tests, lint and typechecking, and the complete suite pass without public API or copy changes.
