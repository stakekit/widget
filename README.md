# StakeKit Widget

StakeKit Widget is an embeddable React interface for staking, yield, and
borrowing journeys. It is published as both a React component and an imperative
browser renderer.

## Install

```sh
pnpm add @stakekit/widget
```

React 19 or newer is required when using the component entrypoint.

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
running widget can safely consume it. Wallet topology, including connector
mode, provider presence, connector construction, and related wallet setup, is
fixed during bootstrap. Remount the widget to change it.

The package exports the supported chain constants, dashboard yield categories,
wallet types, Wallet Policy, transaction metadata types, and themes. Prefer
those exports over copying their shapes into host code.

## External providers

Use `externalProviders` when your application already manages the user's
wallet. The host owns the wallet connection, active account, and chain. The
widget calls your adapter to request signatures, switch chains, and submit
transactions. This adapter implements `SKWallet`; it is not a raw EIP-1193
provider or a wallet SDK client.

### React setup

Pass the host's wallet state as props. This example limits the widget to
Arbitrum and Polygon, which must also be available in its configured wallet
topology:

```tsx
import "@stakekit/widget/style.css";
import {
  EvmChainIds,
  SKApp,
  type SKWallet,
  type SupportedSKChainIds,
} from "@stakekit/widget";

export function ExternalWalletWidget({
  apiKey,
  wallet,
  address,
  chainId,
}: {
  apiKey: string;
  wallet: SKWallet;
  address: string;
  chainId: SupportedSKChainIds;
}) {
  return (
    <SKApp
      apiKey={apiKey}
      borrowEnabled={false}
      externalProviders={{
        type: "generic",
        provider: wallet,
        currentAddress: address,
        currentChain: chainId,
        supportedChainIds: [EvmChainIds.Arbitrum, EvmChainIds.Polygon],
      }}
    />
  );
}
```

Implement `wallet` using your wallet SDK:

| Method | Contract |
| --- | --- |
| `signMessage(message)` | Return a promise resolving to the signature string. |
| `switchChain(chainId)` | Switch the host wallet and resolve when the switch completes. Publish the new `currentChain` through props. |
| `sendTransaction(tx, txMeta)` | Sign and broadcast the transaction. Return its hash, `{ type: "success", txHash }`, or `{ type: "error", error }`. |
| `signTypedData(typedData)` | Optional EIP-712 signing callback. Required by flows that request typed-data signatures. |

Use `SKWallet` to type the adapter. Transaction inputs are the widget's `SKTx`
and `SKTxMeta`, not a wallet SDK's transaction types. Narrow `tx.type` before
converting its payload for your SDK. Bind SDK methods or wrap them in arrow
functions if they depend on `this`.

Reject callback promises when the wallet rejects an operation. Do not return
an empty signature or a fabricated transaction hash to indicate failure.

### Live updates and browser hosts

Changes to `currentChain`, `currentAddress`, `supportedChainIds`, and provider
callbacks are consumed live. In React, pass updated props without changing the
component's `key`. In Angular or another non-React host, use the browser
renderer and call `rerender` when the wallet changes:

```ts
import "@stakekit/widget/style.css";
import {
  renderSKWidget,
  type BundledSKWidgetProps,
} from "@stakekit/widget/bundle";

type ExternalProvider = NonNullable<BundledSKWidgetProps["externalProviders"]>;

export function mountExternalWallet(
  container: Element,
  apiKey: string,
  externalProviders: ExternalProvider,
) {
  const props = { apiKey, borrowEnabled: false, externalProviders } satisfies
    BundledSKWidgetProps;
  const widget = renderSKWidget({ ...props, container });

  return {
    update(nextProvider: ExternalProvider) {
      widget.rerender({ ...props, externalProviders: nextProvider });
    },
    unmount: widget.unmount,
  };
}
```

Call the returned `update` method with a new provider snapshot on host wallet
changes, and call `unmount` when the host component is destroyed.
`rerender` replaces the widget props; it does not merge a partial update.
Preserve the API key and any other settings on every call.

Keep `externalProviders` present while the host wallet is disconnected. Set
`currentAddress` to `""`, not `null` or `undefined`. Restoring the address
reconnects the provider. Do not remove the provider or remount just to report
an account change.

Deferred signing and transaction operations use the current provider callbacks
when execution starts. Updating an adapter does not cancel an operation that
has already started.

### Chain selection

- `currentChain` is the host wallet's actual chain, including on initial
  connection. If omitted, the widget uses the first supported configured chain.
  Pass it explicitly rather than relying on chain ordering.
- `supportedChainIds` filters the chains the adapter supports. Omitting it
  allows all chains in the widget's configured topology. It does not add chains
  to that topology.
- An explicit `[]`, or a list with no chains in the configured topology, is an
  error at initialization and on live updates. It does not mean disconnected.
  An invalid live list fails the wallet runtime. Remount with valid
  configuration to recover.
- A `currentChain` outside the allowed chains is unsupported. The widget
  preserves the host's chain identity but disables signing and transactions.
  Update the host chain or the supported list to restore a usable connection.

Use the exported `EvmChainIds`, `MiscChainIds`, and `SubstrateChainIds`
constants. `SupportedSKChainIds` is a union of supported numeric IDs, not an
arbitrary `number`. Validate IDs from your wallet SDK before passing them to
the widget rather than casting unknown values to this type.

Remount when changing provider presence, connector mode, or the configured
wallet topology. Ordinary account, chain, supported-list, and callback updates
do not need a remount. Unmount the previous instance before mounting another.

### Borrow support

For staking without Borrow, use `SKWallet` and `borrowEnabled: false`.
`sendBorrowTransaction` is not required.

To enable Borrow with an external provider:

- Set `borrowEnabled: true`.
- Set `externalProviders.supportsBorrow: true`.
- Implement `SKBorrowWallet`, which adds
  `sendBorrowTransaction(tx, txMeta)` to `SKWallet`.

The Borrow callback receives `SKBorrowTx` and `SKBorrowTxMeta` and returns the
same success or error shapes as `sendTransaction`. Do not cast a staking-only
adapter to `SKBorrowWallet` to satisfy a compiler error.

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
