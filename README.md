# StakeKit Widget

StakeKit Widget is an embeddable React interface for staking, yield, and
borrowing journeys. It is published as both a React component and an imperative
browser renderer.

## Install

```sh
pnpm add @stakekit/widget
```

React 18 or newer is required when using the component entrypoint.

## React

```tsx
import "@stakekit/widget/style.css";
import { darkTheme, SKApp } from "@stakekit/widget";

export function Staking() {
  return <SKApp apiKey={import.meta.env.VITE_API_KEY} theme={darkTheme} />;
}
```

In Next.js, render `SKApp` from a client component. See the
[`with-vite`](packages/examples/with-vite) and
[`with-nextjs`](packages/examples/with-nextjs) examples for complete hosts.

## Browser renderer

Use the bundled entrypoint when the host does not render React components:

```ts
import "@stakekit/widget/style.css";
import { darkTheme, renderSKWidget } from "@stakekit/widget/bundle";

const widget = renderSKWidget({
  container: document.querySelector("#stakekit-widget")!,
  apiKey: "your-api-key",
  theme: darkTheme,
});

widget.rerender({ apiKey: "your-api-key", theme: darkTheme });
widget.unmount();
```

Only one Widget Instance may be mounted in a browser document at a time.
Unmounting it before mounting another instance is supported.

## Configuration

`SKAppProps` and `BundledSKWidgetProps` are the source of truth for supported
configuration. Import those types from the same entrypoint as the integration:

```ts
import type { SKAppProps } from "@stakekit/widget";
import type { BundledSKWidgetProps } from "@stakekit/widget/bundle";
```

Common options include:

- API endpoints and the required `apiKey`
- `lightTheme`, `darkTheme`, or a custom `SKTheme`
- classic or dashboard layout configuration
- initial chain and yield preferences
- translations, icon mappings, and declarative wallet filtering, grouping, and
  ordering through `walletPolicy`
- external wallet providers and borrowing support
- tracking callbacks

Configuration passed after mount is normalized and becomes live where the
running widget can safely consume it. Wallet topology—connector mode, provider
presence, connector construction, and related wallet setup—is fixed during
bootstrap; remount the widget to change it.

The package exports the supported chain constants, dashboard yield categories,
wallet types, Wallet Policy, transaction metadata types, and themes. Prefer
those exports over copying their shapes into host code.

## Styling

Import `@stakekit/widget/style.css` once. Start with `lightTheme` or `darkTheme`
and pass a partial custom theme when necessary:

```tsx
import { darkTheme, type SKTheme, SKApp } from "@stakekit/widget";

const theme: SKTheme = {
  ...darkTheme,
  color: {
    ...darkTheme.color,
    primaryButtonBackground: "#6d5dfc",
  },
};

<SKApp apiKey="your-api-key" theme={theme} />;
```

Use the exported `SKTheme` type as the current contract rather than maintaining
a handwritten list of theme tokens.

## Development

This repository uses the pnpm version pinned by mise:

```sh
mise exec -- pnpm install
mise exec -- pnpm dev
```

Useful checks are `mise exec -- pnpm lint`, `mise exec -- pnpm test`, and
`mise exec -- pnpm check`. Contributor workflow and codebase conventions live
in [`AGENTS.md`](AGENTS.md).
