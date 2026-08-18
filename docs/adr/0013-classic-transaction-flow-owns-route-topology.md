---
status: accepted
---

# Classic Transaction Flow owns its route topology

Classic Transaction Flow publishes one route-element factory from its
`composition.ts` entry.
The factory accepts an Enter, Exit, Manage, or Activity Resume mount and returns
the relative React Router route elements for that journey. Activity Resume has
explicit Classic and Dashboard presentations because those existing route
shapes differ.

The feature-owned route module owns the relative Review, Steps, and Complete
paths, route parameters, Flow Session intake guard, Review and Execution scope
topology, and journey pages. Its headless interface also owns the predicate that
determines whether a pathname belongs to the current Flow Session, deriving the
answer from that session's destinations instead of duplicating absolute app
paths.

Application route composition continues to choose the Classic or Dashboard
shell, the parent path at which a journey mounts, and app-level guards such as
the Wallet Scope fallback policy. The factory returns route elements rather
than rendering a nested `Routes` component, so the app retains one matching
tree while callers do not reassemble feature-private pages and scopes.

## Rejected alternatives

- Publish the individual route guards, scopes, and pages, because every caller
  must then reproduce the Flow Session lifecycle topology and can pair them
  incorrectly.
- Accept caller-supplied paths, pages, scopes, or flags such as
  `includeComplete`, because those options expose the implementation instead of
  providing one deep route module.
- Render a `ClassicFlowRoutes` component directly under `Routes`, because React
  Router only accepts `Route` elements or fragments there.
- Render an inner `Routes` component, because it introduces another matching
  layer and changes the existing route semantics.
- Convert the app's complete Classic and Dashboard trees to route objects for
  this refactor, because that broad migration is unnecessary to move the
  feature seam.
