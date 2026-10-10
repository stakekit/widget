# Wallet handling

How the widget finds wallets, connects them, keeps them connected, and signs
with them. Ownership and dependency rules are in
`packages/widget/ARCHITECTURE.md`; the WalletConnect decision is
[ADR 0010](adr/0010-widget-owns-the-walletconnect-protocol.md). Paths below are
relative to `packages/widget/src`.

## Components

```mermaid
flowchart TB
  User((User))

  subgraph UI["features/wallet/ui (React: render + dispatch)"]
    Btn["connect-button<br/>header Connect / network / account buttons"]
    Picker["connect-modal<br/>choose chain family, then wallet"]
    Account["account-modal<br/>copy address, disconnect"]
    Chain["chain-modal<br/>switch network, add Ledger account"]
    Dialog["wallet-dialog<br/>shared dialog shell, focus, portal"]
  end

  subgraph State["features/wallet/state (Effect Atom adapters)"]
    PickerAtom["connectPickerAtom<br/>picker rows from connectors + availability"]
    ConnectCmd["connectWalletAtom<br/>connect with initialChain"]
    PresSvc["WalletPresentationService<br/>account / chain dialog workflows"]
    Model["model/connect-picker.ts<br/>availability policy, grouping, initialChain"]
  end

  subgraph Svc["services/wallet (WalletService and friends)"]
    WS["WalletService<br/>connect, logout, sign*, switchChain,<br/>state stream, connectors, availability"]
    Modal["WalletModal<br/>connectOpen, chainOpen, presentationOpen"]
    Desc["wallet-descriptors<br/>WalletDescriptor, WalletAvailability,<br/>connectorsForWallets"]
    Errors["wallet-errors<br/>WalletNotAvailableError, ..."]
  end

  subgraph Runtime["services/wallet/internal/runtime"]
    Boot["bootstrap<br/>Wallet Topology, wagmi config, reconnect"]
    Proj["state-projection<br/>Wallet State from wagmi + family state"]
    Router["router<br/>sends sign/switch to the family driver"]
  end

  subgraph Platform["services/wallet/internal/platform"]
    Wagmi["WagmiPlatform<br/>wagmi config, connectors, actions"]
    Sol["SolanaPlatform<br/>wallet-adapter runtime"]
    Stellar["StellarWalletsKitPlatform<br/>Stellar extension + WC clients"]
    Proto["WalletConnectProtocol<br/>one SignClient (stakekit-walletconnect)"]
    Pres["WalletConnectPresentation<br/>AppKit QR / wallet list / deep link"]
  end

  subgraph Adapters["services/wallet/internal/adapters (one per chain family)"]
    EVM["evm<br/>extensions, MetaMask, Coinbase, Ledger,<br/>wagmi walletConnect (clientTwo)"]
    Cosmos["cosmos<br/>Keplr, Leap, Leap Snap + WC"]
    Sub["substrate<br/>Talisman, SubWallet + WC"]
    Tron["tron<br/>TronLink, Bitget, Ledger + WC"]
    SolA["solana<br/>Wallet Standard / adapters + WC"]
    StA["stellar<br/>Freighter, LOBSTR, xBull, Albedo + WC"]
    Oth["ton, cardano, ledger live,<br/>safe, external-provider"]
  end

  subgraph Ext["Outside the widget"]
    Inj["Injected providers<br/>window.ethereum, keplr, tronLink, ..."]
    Relay["WalletConnect relay"]
    Phone["Mobile wallet app"]
    AppKit["Reown AppKit modal"]
  end

  User --> Btn & Picker & Account & Chain
  Btn & Picker & Account & Chain --> Dialog
  Picker --> PickerAtom & ConnectCmd
  Account & Chain --> PresSvc
  PickerAtom --> Model
  ConnectCmd --> Model
  PickerAtom --> WS
  ConnectCmd --> WS
  PresSvc --> WS
  PickerAtom & Account & Chain --> Modal

  WS --> Boot & Proj & Router
  WS --> Modal
  Boot --> Wagmi & Sol & Stellar
  Boot --> Desc
  Desc --> Adapters
  Router --> Adapters
  Wagmi --> Adapters
  Sol --> SolA
  Stellar --> StA
  Adapters -. "extension missing" .-> Errors

  Cosmos & Sub & Tron & SolA & StA --> Proto
  EVM -- "pairing link" --> Pres
  Proto --> Pres
  Pres --> AppKit
  Pres --> Modal
  Proto <--> Relay
  Relay <--> Phone
  AppKit -- "QR / deep link" --> Phone
  Adapters <--> Inj
```

## What each part does

| Part | Responsibility |
|---|---|
| `ui/wallet-dialog` | Radix dialog used by every wallet dialog. Portals into the configured container, carries the theme root, restores focus to the opener, and hides itself (`suspended`) while AppKit or TonConnect's modal is on top. Bottom sheet below 520px, centred dialog above. |
| `ui/connect-modal` | The picker: chain family list, then wallets grouped into "Installed" and catalogue groups. Shows Connect, Install (store link) or a non-interactive Checking row. Footer disclaimer. |
| `ui/account-modal`, `ui/chain-modal` | Account actions and network switching; Ledger chains not yet added route to "add Ledger account". |
| `model/connect-picker.ts` | Plain functions: the availability policy, grouping, first-paint placement, and `connectionChainId` (host `initialChain` when the wallet supports it). |
| `state/wallet-modal.ts` | `connectPickerAtom` and `connectWalletAtom`: shallow adapters between the picker and `WalletService`. |
| `WalletPresentationService` | Feature service for account and chain dialog workflows. |
| `WalletService` | The wallet runtime's single entry point: `connect`, `logout`, `signMessage`, `signTypedData`, `signTransaction`, `switchChain`, `switchAccount`, `addLedgerAccount`, the Wallet State stream, `connectors`, and the per-wallet `availability` cache with `detectAvailability`. |
| `WalletModal` | Open state of the connect and chain dialogs, plus `presentationOpen` while AppKit or TonConnect's modal is visible. |
| `wallet-descriptors.ts` | The owned wallet catalogue format. Each wallet declares `availability`: `Remote` or `Injected { detect, installUrl? }`. `connectorsForWallets` turns descriptors into wagmi connectors. |
| `runtime/bootstrap` | Captures Wallet Topology once (networks, connector mode), builds the wagmi config with all family connectors, and runs wagmi reconnect. |
| `runtime/state-projection` | Derives the authoritative Wallet State from wagmi and family state. |
| `runtime/router` | Sends sign, switch and account requests to the connected family's driver. |
| `WagmiPlatform`, `SolanaPlatform`, `StellarWalletsKitPlatform` | Library integrations owned behind Effect services. |
| `WalletConnectProtocol` | One `SignClient` per page (shared by every widget mount) for every non-EVM family: propose (and resume a pending proposal, or adopt a session approved after the QR was closed), restore sessions, request with Schema-decoded responses, disconnect one topic, report remote session ends per topic. A session is returned only for the namespace the widget proposed it for. Loads the SDK only when a session was approved before or a wallet is chosen. |
| `WalletConnectPresentation` | Shows a pairing link through AppKit (`manualWCControl`, its own inert provider). Cancels when the user closes it; opens wallet deep links. |
| Family adapters | Turn each chain family into wagmi connectors. Extension wallets use their libraries; WalletConnect wallets use the shared protocol (EVM keeps wagmi's own). |

## Main flows

### Opening the picker and connecting an extension

```mermaid
sequenceDiagram
  actor U as User
  participant P as connect-modal
  participant A as connectPickerAtom
  participant WS as WalletService
  participant F as Family connector
  participant X as Extension

  Note over WS,F: After bootstrap, WalletService runs every Injected detect in the background and caches the result per wallet.
  U->>P: Connect Wallet
  P->>A: open
  A->>WS: detectAvailability (re-check in background)
  A-->>P: rows from cached results (Checking where none yet)
  U->>P: choose family, then wallet
  P->>WS: connect(connector, initialChain if supported)
  WS->>F: connect
  F->>X: request accounts
  alt extension gone
    F-->>WS: WalletNotAvailableError
    WS-->>P: "wallet not available"
  else approved
    X-->>F: accounts
    F-->>WS: connected
    WS-->>P: Wallet State: connected, dialog closes
  end
```

### Connecting over WalletConnect (non-EVM)

```mermaid
sequenceDiagram
  actor U as User
  participant F as Family WC adapter
  participant PR as WalletConnectProtocol
  participant WP as WalletConnectPresentation
  participant AK as AppKit
  participant W as Mobile wallet

  U->>F: choose WalletConnect
  F->>PR: sessions(namespace)
  alt live session exists
    PR-->>F: session (no QR)
  else
    F->>PR: connect(proposal)
    PR->>WP: pairing URI
    WP->>AK: open QR / wallet list (picker suspended)
    U->>W: scan or open deep link
    W-->>PR: approve session
    PR-->>F: session for this namespace
    WP->>AK: close (picker resumes)
  end
  Note over U,AK: Closing AppKit cancels the attempt; retrying resumes the same pending proposal.
  W-->>PR: session_delete / session_expire
  PR-->>F: ended(topic)
  F-->>F: emit wagmi disconnect
```

### After a page reload
Wallet bootstrap runs wagmi reconnect. Each connector answers `isAuthorized`
from its own state: extensions from the injected provider, WalletConnect
families from `WalletConnectProtocol.sessions(namespace)` (a live, unexpired
session the widget approved for that namespace, holding the stored account).
Explicit disconnects leave a marker that stops restoration. Reconnect never
shows a QR.
Cosmos connectors restore the chain they last connected on: extensions save it
in wagmi storage and fall back to a chain cosmos-kit restored; WalletConnect
reuses any live Cosmos session holding a chain's account before proposing.

### Signing
Transaction flows call `WalletService.signTransaction`, the router picks the
connected family's driver, and the driver signs through its extension or
through `WalletConnectProtocol.request` with the family's RPC method.

## Wallet availability policy

| Wallet | Picker shows |
|---|---|
| Remote | Connect |
| Injected, detected | Connect, in "Installed" (decided at first paint of each opening) |
| Injected with store link, desktop, not detected | Install |
| Injected with store link, desktop, still checking | Checking, same row and height |
| Injected without store link, or on mobile, not detected | Hidden |
| Chain family with nothing visible | Hidden |

Rows are never added, removed or reordered while the picker is open on
desktop; a late result only changes the row's action.

## Persisted state

| Key / prefix | Owner | Purpose |
|---|---|---|
| `wc@2:*:stakekit-walletconnect` | WalletConnectProtocol | Non-EVM WalletConnect sessions and pairings |
| `wc@2:*:stakekit-appkit-presentation` | WalletConnectPresentation | AppKit's inert provider; never holds a session |
| `wc@2:*:clientTwo` | wagmi `walletConnect` | EVM WalletConnect sessions |
| `sk-widget@1//walletConnectSessions` | WalletConnectProtocol | Whether to load the SDK on the next page load |
| `sk-widget@1//walletConnectSessionOwner/<topic>` | WalletConnectProtocol | Namespace the topic was proposed for (one key per topic, so tabs never overwrite each other); unowned sessions are never restored. Removed on disconnect, remote end or expiry |
| `wagmi.*` | wagmi and family connectors | Recent connector, per-family connection and disconnect markers |

## Tests

- `tests/utils/wallet-connect.ts`: the real protocol and presentation over a
  fake `SignClient` and fake AppKit; share a store to model a reload.
- `tests/utils/wallet-connect-picker.tsx`: the real picker and runtime with fake
  connectors and injected providers.
- Per family: `tests/providers/wallet/*-wallet-connect.test.ts` and
  `*-wallet-availability.test.ts`.
