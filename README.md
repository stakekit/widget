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
| `signMessage(message)` | Return the signature string, `{ type: "success", signature }`, `{ type: "cancelled" }` when the user declines, or `{ type: "error", error }`. |
| `switchChain(chainId)` | Switch the host wallet and resolve when the switch completes. Publish the new `currentChain` through props. |
| `sendTransaction(tx, txMeta)` | Sign and broadcast the transaction. Return its hash, `{ type: "success", txHash }`, `{ type: "cancelled" }` when the user declines, `{ type: "error", error }`, or `{ type: "error", error, txHash }` when it was broadcast before failing. |

`{ type: "cancelled" }` shows a cancellation notice with a retry instead of an
error. `error` text, and the message of a rejected Promise, is shown to the
user.

Always return the hash once a transaction was broadcast, even if the user left
the transaction steps meanwhile: while it stays mounted, the widget still
registers that hash with the API. Include `txHash` with an `error` when the
transaction was broadcast before the failure (for example a receipt timeout);
without it, the widget treats the step as not broadcast and lets the user sign
it again.

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
The Borrow callbacks are not required.

To enable Borrow with an external provider, set `borrowEnabled: true` and pass
an `SKBorrowWallet`. It extends `SKWallet` with two required callbacks, and the
widget rejects the configuration when either is missing:

- `sendBorrowTransaction(tx, txMeta)` receives `SKBorrowTx` and
  `SKBorrowTxMeta` and resolves with an `SKBorrowTxResult`.
- `signTypedData(typedData, txMeta)` receives an `SKEip712TypedData` Borrow
  authorization and the same `SKBorrowTxMeta`, and resolves with an
  `SKBorrowSignatureResult`.

Both results are discriminated by `type`:

| Result | Meaning | Widget behavior |
|---|---|---|
| `{ type: "success", txHash }` / `{ type: "success", signature }` | Broadcast or signed. Resolve as soon as the transaction is broadcast; do not wait for confirmation. | Continues the flow. |
| `{ type: "cancelled" }` | The user declined in the wallet. | Shows a cancellation notice and lets the user try again. |
| `{ type: "error", error }` | Failed; nothing was broadcast. | Shows `error` and lets the user retry the step. |
| `{ type: "error", error, txHash }` | Broadcast, then failed (for example a receipt timeout). Transactions only. | Tracks `txHash` instead of asking to sign again. |

Always include `txHash` once a transaction was broadcast; omitting it lets the
user sign the same step again, which can send it twice. A rejected Promise is
treated as an `error` without `txHash`, using the `Error` message or rejected
string.

The EVM `SKBorrowTx` keeps the API's transaction type: `"0x0"` (legacy, with
`gasPrice`) or `"0x2"` (EIP-1559, with `maxFeePerGas` and
`maxPriorityFeePerGas`). Fee fields are `undefined` when the API does not quote
them; estimate them in the host wallet.

EVM transactions (`SKTx` and `SKBorrowTx`) carry no `nonce`; the host wallet
selects it when signing.

`borrowEnabled` alone decides whether Borrow can use the provider; there is no
separate provider flag. Do not cast a staking-only adapter to `SKBorrowWallet`
to satisfy a compiler error.

`borrowMarketsScope` selects the market catalog offered for new borrows:
`"all"` (default) lists every supported market, and `"enabled"` lists only the
markets enabled for your API key's project. Existing positions stay visible and
manageable in either mode. Live updates switch the listed catalog without a
remount.

### Zama confidential vaults

Zama deposits need the optional `signZamaPermit(typedData, meta)` callback on
`SKWallet` (and therefore on `SKBorrowWallet`). It signs the EIP-712 permit
that reveals confidential balances and resolves with an `SKZamaPermitResult`.
Without it, the widget blocks Zama deposits, because the balance could not be
revealed to withdraw.

Zama encryption runs in a Web Worker. Hosts built with webpack, Turbopack or
Vite copy its script from `dist` automatically, and the widget starts it from
that copy after a same-origin `HEAD` request finds it (`connect-src 'self'`).
Otherwise, for example in Angular, with a CDN-hosted bundle or a cross-origin
Next.js `assetPrefix`, it starts a copy inlined into a lazy chunk from a `blob:`
URL, which needs `worker-src blob:` (or `data:`). If neither works, encryption
runs on the page's main thread.

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
