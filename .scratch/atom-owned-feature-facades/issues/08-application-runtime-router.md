# 08 — Move memory-router ownership into the Application Runtime Generation

**What to build:** A scoped synchronous Application Router runtime owns and disposes the memory router, exposes it only to the React composition boundary, and supplies its Effect Context to application navigation without a React or adapter bridge.

**Blocked by:** 07 — Contract legacy hooks and verify the final architecture.

**Status:** complete

- [x] The first Application Router Atom read synchronously returns the existing memory-router type without a loading or fallback state.
- [x] `WidgetNavigation` is constructed directly from `ApplicationRouter` and preserves canonical paths, history operations, typed failures, and scroll-reset policy.
- [x] React only reads the runtime-owned router and passes it to the DOM `RouterProvider`.
- [x] Live settings changes preserve router identity while API-identity replacement and sequential remount receive fresh memory history.
- [x] Closing the Application Runtime Generation disposes the router exactly once.
- [x] The navigation adapter type, adapter Atom, provider input, React forwarding object, and adapter-specific test utilities are removed.
- [x] Classic and Dashboard route definitions remain declarative, and the router remains a memory router.
