# StakeKit Widget with Angular

Minimal Angular host that renders the bundled entrypoint
(`@stakekit/widget/bundle`), used to smoke-test the build under Angular's
esbuild application builder and its Vite-based dev server.

Angular does not load `.env` files. The scripts read `VITE_API_KEY` from the
environment and inline it with `--define`. From the repository root:

```sh
VITE_API_KEY=<key> mise exec -- pnpm --filter @stakekit/with-angular dev
```

`angular.json` mirrors a host we support and keeps the smoke test honest:

- The dev server excludes `@stakekit/widget` from pre-bundling, so Angular's
  esbuild bundles the widget itself, as it does for that host.
- `cli.cache.environment: "all"` keeps the build cache on when `CI=true`;
  Angular disables dev-server pre-bundling without it.

The integration is in [`src/app.ts`](src/app.ts).
