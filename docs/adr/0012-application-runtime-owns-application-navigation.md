---
status: accepted
---

# Application Runtime Generation owns application navigation

Application-owned navigation decisions are executed through a headless `WidgetNavigation` module in the application Atom runtime. A scoped `ApplicationRouter` Layer owns the memory router for one Application Runtime Generation, and `WidgetNavigation` is constructed directly from that service. Commands use canonical absolute widget paths and state whether navigation pushes, replaces, or goes back, plus whether normal widget scroll-reset policy applies.

React obtains the runtime-owned router synchronously through an internal Atom and passes it to `RouterProvider`; feature modules do not receive the raw router. Closing the Application Runtime Generation disposes the router, and replacing generation identity starts a fresh router with fresh memory history. Generation identity consists of API identity plus mount-time feature configuration such as `borrowEnabled`; live settings changes within the same generation preserve the router.

Workflow commands and transition events invoke navigation directly after their ownership and stale-result checks. Derived view Atoms remain passive, and application logic no longer publishes navigation outcomes for React effects or `<Navigate>` adapters to apply. Declarative route guards, view-local tabs and back controls, route reads used only for presentation, and external URL navigation remain view concerns.

This refines ADR-0004's router-boundary allowance and the routing responsibilities in ADR-0005 through ADR-0007. Flow Session and Execution Attempt scopes still own their navigation decisions and stale-output suppression; the Application Router owns only router construction, memory history, subscription, and disposal, while `WidgetNavigation` owns application navigation commands and scroll-reset policy.

## Rejected alternatives

- Publish navigation outcomes for React to observe and apply, because it introduces an Atom-to-React command bridge and duplicate-delivery coordination.
- Expose the router instance to feature modules, because it leaks router lifecycle and capabilities instead of providing one narrow navigation interface.
- Construct or retain the router in React state, because router construction and disposal belong to the Application Runtime Generation and data routers should be created outside the React tree.
- Use a module-global router, because sequential Widget Instance mounts require fresh memory history.
- Retain a production navigation adapter between `ApplicationRouter` and `WidgetNavigation`, because it adds no independent policy or lifecycle and duplicates the service boundary.
- Preserve route-relative workflow destinations, because resolving them depends on React route context and makes command tests ambiguous.
