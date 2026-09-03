# StakeKit Widget with Next.js

Minimal Next.js host used to verify that the package works in a production
server-rendered application. The widget itself is mounted from a client
component.

Set `NEXT_PUBLIC_API_KEY` in `.env`, then run from the repository root:

```sh
mise exec -- pnpm --filter @stakekit/with-nextjs dev
```

The integration is in [`src/app/widget/widget.tsx`](src/app/widget/widget.tsx).
