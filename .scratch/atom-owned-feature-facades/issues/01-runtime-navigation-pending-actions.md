# 01 — Add runtime navigation through pending-action deep links

**What to build:** Application-owned commands can navigate through the Widget Instance's memory router without publishing a navigation outcome for React to consume. Pending-action deep links are the first complete journey to use that capability.

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] A runtime-scoped navigation capability supports canonical absolute push, replace, back, and scroll-reset decisions.
- [x] Pending-action deep-link commands navigate directly and no React effect coordinates their delivery.
- [x] Production and in-memory test adapters demonstrate isolation between sequential Widget Instances.
- [x] Declarative route guards and view-local navigation remain React-owned.
