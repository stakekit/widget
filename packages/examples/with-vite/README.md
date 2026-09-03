# StakeKit Widget with Vite

Minimal React + Vite host used to develop and smoke-test the package entrypoint.

Set `VITE_API_KEY` in `.env.development.local`, then run from the repository
root:

```sh
mise exec -- pnpm --filter @stakekit/with-vite dev
```

The integration is in [`src/widget/index.tsx`](src/widget/index.tsx).
