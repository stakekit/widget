# WalletService-owned Wallet Runtime

Status: ready-for-agent

## Problem Statement

Wallet Bootstrap and Wallet State are currently distributed across keyed atoms, controller resources, React-fed Solana inputs, lifecycle atoms, and a WalletService that must be bound back to atom-owned state before its commands work. This creates multiple authorities for the same wallet, allows configuration changes to reconstruct Wagmi during a mounted widget generation, and makes command routing depend on whichever atom/controller binding is current.

The widget needs one scoped owner for wallet initialization, state, effects, commands, discovery, and cleanup. A host should receive predictable behavior from the configuration and external provider available when a Wallet Runtime starts, while ordinary later configuration changes must not silently replace the underlying wallet system. The UI and workflows still need reactive wallet data, but they should consume read-only Wallet Projections rather than own or rebind canonical Wallet State.

Solana is the most visible ownership leak: React providers currently construct the connection and discover wallets, then copy those values into an atom that participates in Wagmi initialization. Removing that bridge requires a headless runtime that preserves supported discovery, fallback, readiness, mobile, and connector behavior without rebuilding the Wagmi config.

## Solution

Make WalletService the sole owner of one Wallet Runtime per application-runtime generation. During Wallet Bootstrap it captures one immutable Wallet Bootstrap Snapshot, resolves the enabled networks and initialization inputs, constructs one Wagmi config, installs and seeds its core watchers, and publishes an atomic runtime snapshot. It then processes all wallet, connector, enrichment, external-provider, and discovery events through one serialized event loop.

WalletService exposes its current runtime snapshot, a stream of changes, the service-owned Wagmi config, and wallet commands. Commands fail immediately until the Wallet Runtime is ready and capture one Wallet State snapshot for the duration of each operation. Feature atoms become read-only adapters and selectors over WalletService. React remains only as the adapter for third-party tree-scoped Wagmi and RainbowKit contracts.

Wallet Topology remains fixed for the lifetime of the Wallet Runtime. Ordinary wallet-related configuration updates are ignored after bootstrap. External Provider Snapshot values remain live when the runtime started in external-provider Connector Mode, but adding or removing external-provider presence after bootstrap is a Wallet Runtime Invariant violation and terminally poisons only that Wallet Runtime.

Solana connection construction and wallet discovery move into a scoped headless runtime. It uses the modern Wallet Standard registry, adapter readiness events, explicit fallbacks, Android Mobile Wallet Adapter parity, and dynamic connector membership within the already-created Wagmi config. Same-name Standard adapters take precedence, but an active fallback adapter is never hot-swapped.

## User Stories

1. As a widget host, I want wallet infrastructure to initialize once per mounted application generation, so that ordinary configuration rerenders cannot replace an active wallet runtime.
2. As a widget host, I want Wallet Bootstrap to use one atomic snapshot of current inputs, so that the runtime cannot combine values observed at different moments.
3. As a widget host, I want post-bootstrap wallet configuration changes to be ignored, so that the configured Wallet Topology remains stable.
4. As a widget host, I want a remounted application generation to receive a fresh Wallet Runtime, so that old listeners, adapters, connections, and state do not leak into the new mount.
5. As a widget host using an external provider, I want current address, current chain, supported chains, and provider operations to remain live, so that the widget follows the host wallet without rebuilding Wagmi.
6. As a widget host, I want adding or removing external-provider presence after bootstrap to fail visibly as an invariant violation, so that an invalid integration cannot continue in a mixed Connector Mode.
7. As a widget host, I want an external-provider connector mismatch to fail immediately and be logged once, so that impossible connector routing is diagnosed rather than silently ignored.
8. As a widget user, I want wallet connection state to remain reactive, so that UI and workflows reflect connector changes without owning those changes.
9. As a widget user, I want account and chain changes to update atom-backed UI consistently, so that every screen observes the same Wallet State.
10. As a widget user, I want wallet commands to use the state visible when the command begins, so that a concurrent account or connector update cannot reroute an in-flight signing operation.
11. As a widget user, I want commands issued before readiness to fail immediately, so that the UI never waits indefinitely for an internal binding.
12. As a widget user, I want commands issued after a terminal Wallet Runtime failure to return typed failures, so that the widget can surface a deterministic error.
13. As a widget user, I want reconnect behavior to remain unchanged, so that previously authorized wallets still reconnect when possible.
14. As a mobile widget user, I want the existing injected-provider fallback behavior to remain unchanged, so that mobile wallets still connect when reconnect finds no active connection.
15. As a widget user arriving with an initial chain parameter, I want the runtime to attempt the same initial switch, so that entry links retain their current behavior.
16. As a widget user, I want reconnect, mobile fallback, and initial switching failures to remain recoverable, so that manual wallet connection remains available.
17. As a widget user, I want unsupported connected chains to trigger the existing automatic disconnect policy, so that workflows do not operate against unsupported state.
18. As an analytics consumer, I want each supported wallet connection to be tracked once, so that moving lifecycle ownership does not duplicate connection events.
19. As a widget user, I want Ledger account state to remain part of the canonical Wallet State, so that account switching and signing stay coherent.
20. As a widget user, I want Cosmos chain-wallet routing to use the same captured Wallet State as other commands, so that transaction commands do not depend on separately published atoms.
21. As a widget user, I want additional addresses to update as part of an atomic Wallet State publication, so that workflows never combine a new account with stale enrichment.
22. As a widget user, I want a recoverable enrichment failure to degrade only that slice, so that a healthy wallet connection remains usable.
23. As a widget user, I want recoverable connector failures to affect only the relevant connector state, so that unrelated connectors remain available.
24. As a widget user, I want a bootstrap construction failure to produce a terminal BootstrapFailed phase, so that partially initialized wallet resources are never presented as ready.
25. As a widget user, I want Wallet State to become ready only after core Wagmi watchers are installed and seeded, so that the first ready snapshot cannot miss a concurrent event.
26. As a Phantom user, I want a discovered Wallet Standard adapter to take precedence over the explicit Phantom fallback, so that only one Phantom option is displayed.
27. As a Phantom user with an active fallback connection, I want late Standard discovery to be deferred, so that my active adapter is not hot-swapped.
28. As a Phantom user, I want the deferred Standard adapter to appear after I disconnect the fallback, so that the modern adapter becomes available without rebuilding the runtime.
29. As a user connected through a Standard adapter that unregisters, I want the runtime to disconnect it before exposing the fallback, so that connector membership and active state cannot disagree.
30. As a Solana user, I want readiness changes to update wallet availability without changing the underlying adapter, so that transient installation state does not reset my wallet integration.
31. As a Solana user, I want explicit Phantom, Trust, and WalletConnect fallbacks preserved, so that current wallet coverage remains available.
32. As an Android Solana user, I want Mobile Wallet Adapter behavior equivalent to the current React provider, so that removing React ownership does not remove mobile discovery.
33. As a Solana user, I want removed Wallet Standard wallets to be removed and disposed according to the registry contract, so that stale adapters do not remain visible.
34. As a browser-wallet user, I want late EVM provider discovery to update connector membership within the existing config, so that environmental discovery remains reactive.
35. As a RainbowKit consumer, I want dynamic connector membership and readiness to appear through the normal Wagmi hooks, so that the wallet UI needs no private discovery bridge.
36. As a React integrator, I want WagmiConfigProvider to expose the service-owned config after bootstrap, so that Wagmi and WalletService share one authority.
37. As a React integrator, I want an inert fallback config only during bootstrap, so that third-party hooks remain mount-safe before the real config exists.
38. As a feature developer, I want wallet atoms to be read-only Wallet Projections, so that feature code cannot accidentally become a second Wallet State owner.
39. As a feature developer, I want the existing feature-facing wallet selectors and hooks to retain their behavior, so that this ownership refactor does not require UI rewrites.
40. As a package consumer, I want the published React and bundled entry APIs to remain compatible, so that upgrading does not require integration changes.
41. As a maintainer, I want WalletService to expose a small behavioral interface, so that wallet orchestration can be tested without mounting every atom and provider.
42. As a maintainer, I want all listener, fiber, adapter, and registry resources scoped to WalletService, so that disposal is deterministic.
43. As a maintainer, I want volatile Wagmi internal connector-store access encapsulated behind one service-owned seam, so that a dependency upgrade has one repair point.
44. As a maintainer, I want the React Solana providers and root-input bridge removed, so that React is no longer an owner of wallet initialization.
45. As a maintainer, I want the legacy Wallet Standard registration path removed, so that the widget uses the modern registry contract only.
46. As a maintainer, I want one serialized wallet event loop, so that related connection, connector, enrichment, and lifecycle updates publish atomically and in order.
47. As a maintainer, I want private connector-specific routing context to remain outside the public Wallet Projection, so that consumers receive a minimal stable snapshot.
48. As a maintainer, I want one active widget per document to remain the supported lifecycle, so that this refactor does not imply unsupported global isolation guarantees.

## Implementation Decisions

- WalletService owns the complete scoped Wallet Runtime: Wallet Bootstrap, the Wagmi config, canonical Wallet State, connector streams, connector-specific routing context, external-provider synchronization, Solana discovery, tracking, unsupported-chain handling, commands, and cleanup.
- Each application-runtime generation constructs one fresh WalletService layer. All watchers, subscriptions, fibers, adapters, Wallet Standard registrations, and other acquired resources are released with that scope.
- WalletService captures one Wallet Bootstrap Snapshot from the current normalized widget configuration, enabled-network result, decoded initialization parameters, browser environment, and external-provider presence. It never reads atom-owned wallet state during or after bootstrap.
- The pure initialization-parameter decoder belongs in the domain layer and may be shared by WalletService and feature projections. Cross-feature initialization atoms may remain for routing and workflow concerns, but they do not own Wallet Bootstrap.
- Wallet Topology is fixed after bootstrap. Later ordinary wallet-related configuration publications do not reconstruct Wagmi, replace connectors selected by configuration, or rerun bootstrap.
- Environment-discovered connector membership may change within the fixed Wallet Topology. This includes browser-injected EVM providers and supported Solana discovery/readiness events.
- Connector Mode is selected once from the Wallet Bootstrap Snapshot. The runtime is either in external-provider mode or another configured connector mode; it cannot transition between modes.
- External Provider Snapshot values remain live through a service-owned current-value abstraction. Changing provider identity, account, chain, supported-chain data, or operations is allowed while external-provider presence remains stable.
- A transition from absent to present external-provider input, present to absent input, or an impossible external-provider connector mismatch is a Wallet Runtime Invariant violation. The service logs it once, enters InvariantViolated, stops accepting wallet work, and poisons only that Wallet Runtime.
- Runtime phases are Bootstrapping, Ready, BootstrapFailed, and InvariantViolated. Bootstrapping may transition to Ready or BootstrapFailed. Ready may transition to InvariantViolated. BootstrapFailed and InvariantViolated are terminal.
- BootstrapFailed is reserved for failures that prevent safe construction of the Wallet Runtime. Recoverable reconnect, initial switching, mobile fallback, connector, and enrichment failures do not produce BootstrapFailed.
- WalletService installs core connection and connector watchers before reading their seed values. Ready is published only after those watchers are active and the first canonical Wallet State has been reduced.
- Reconnect, mobile fallback, and initial requested-chain switching begin after core readiness as scoped background work. They preserve their current ordering and failure-tolerance policy and feed results through the same serialized event loop.
- All wallet-related events enter one serialized service-owned event loop. Each event updates private routing context and publishes one atomic runtime snapshot; consumers never observe partially combined connection, chain, account, Ledger, Cosmos, connector-chain, or additional-address state.
- The public runtime snapshot contains the Wallet Runtime Phase and the minimal Wallet Projection required by consumers. Raw Cosmos chain-wallet objects and other connector-specific command-routing details remain private.
- WalletService exposes the current snapshot and a deduplicated stream of subsequent snapshots. It also exposes the constructed Wagmi config once available and retains one service identity for the runtime generation.
- Commands fail immediately while Bootstrapping and after terminal failure; they never wait on Deferred readiness or an atom binding. Existing operation-specific tagged errors remain the public failure vocabulary, extended only where a distinct runtime-phase failure is necessary.
- Every command captures one canonical state and routing-context snapshot when it begins. An in-flight command completes against that captured snapshot even if later events publish a new Wallet State; the next command uses the new snapshot.
- Transaction signing, message signing, account switching, disconnect, state reads, and connector-specific routing resolve directly from WalletService-owned state. No command reads binding-atom state.
- Tracking a supported connection and disconnecting an unsupported connection move into WalletService lifecycle handling. Both behaviors retain connection-key deduplication and current error-swallowing policy where applicable.
- Atoms become read-only adapters over the WalletService current snapshot and changes stream. They may derive feature-friendly values but cannot write canonical Wallet State or bind it back to the service.
- Initialization-key families, the wallet controller resource, WalletBinding, bind/Deferred readiness, lifecycle ownership atoms, external-provider synchronization atoms, and connection/connector/Ledger/Cosmos/additional-address state ownership atoms are removed or reduced to read-only projections as appropriate.
- WagmiConfigProvider keeps the third-party React context boundary. It provides an inert fallback during Bootstrapping, then provides the WalletService-owned Wagmi config by reference. The service config is not replaced for ordinary configuration changes.
- The Solana runtime constructs the RPC Connection directly and synchronously with behavior equivalent to the current provider. The React Solana provider, Solana root input, layout-effect bridge, nullable connection race, and unsafe connection cast are removed.
- The Solana runtime uses the modern Wallet Standard `getWallets()` registry only. It does not preserve deprecated `navigator.wallets` registration compatibility.
- Wallet Standard and Solana wallet-adapter packages imported by production code become direct package dependencies rather than relying on transitive dependencies.
- The scoped Solana runtime instantiates fallback adapters once per Wallet Runtime, wraps compatible registered Standard wallets, follows registry register/unregister events, subscribes to adapter readiness events, removes and disposes unregistered wrappers, deduplicates by wallet name, filters unsupported adapters, and preserves Android Mobile Wallet Adapter environment behavior.
- Explicit Phantom, Trust, WalletConnect, and Android Mobile Wallet Adapter fallbacks remain. A compatible Standard adapter wins over an inactive same-name fallback.
- The connector-membership transitions validated by the prototype are normative:

  | Event | Active adapter | Required result |
  | --- | --- | --- |
  | Same-name Standard registers | None or unrelated | Publish Standard instead of fallback |
  | Same-name Standard registers | Fallback | Keep fallback active and mark Standard pending |
  | Active fallback disconnects | Standard pending | Publish the pending Standard |
  | Pending Standard unregisters | Fallback | Discard pending Standard and keep fallback |
  | Visible inactive Standard unregisters | None | Publish fallback |
  | Active Standard unregisters | Standard | Disconnect Standard, remove it, then publish fallback |

- An adapter readiness change does not rebuild Wagmi and does not replace the underlying adapter. The prototype established that mutating nested RainbowKit metadata alone does not wake React consumers because Wagmi reuses the previous connector array when all outer connector objects are identical.
- To publish readiness, the service creates a fresh outer connector wrapper with updated metadata while preserving its UID, emitter, methods, and underlying adapter, then republishes connector membership through the existing config. This is wrapper refresh, not an active adapter hot-swap.
- Direct access to Wagmi's internal connector store is encapsulated behind one WalletService-owned connector-membership adapter. No feature atom, React provider, or unrelated connector may depend on that internal API.
- Public package exports and current feature-facing wallet behavior remain compatible. Internal wallet atoms, controllers, bindings, and helpers are not public compatibility constraints and may be removed.
- Production code continues to support one active widget instance per document and clean sequential unmount/remount. Concurrent widget support is not introduced.

## Testing Decisions

- The primary test seam is the scoped WalletService public contract. Tests construct the service with controllable bootstrap, environment, Wagmi, registry, tracking, and persistence dependencies; drive events through those dependencies; and assert only runtime phases, current snapshots, change streams, commands, lifecycle effects, invariants, and disposal.
- WalletService tests cover one-time bootstrap, atomic snapshot capture, ignored post-bootstrap configuration, service identity stability, scoped remount isolation, listener cleanup, watcher-before-seed ordering, and terminal bootstrap failure.
- WalletService tests cover serialized state publication across connection, connector, chain, account, Ledger, Cosmos, connector-chain, and additional-address changes. They assert complete observable snapshots rather than private reducer steps.
- Command tests cover immediate pre-ready failure, terminal-phase failure, snapshot capture for in-flight commands, next-command use of newly published state, and coherent routing for signing, disconnect, and account switching.
- External-provider tests cover live address/chain/supported-chain/provider changes, automatic connection synchronization, presence changes in both directions, connector mismatch invariants, log-once behavior, and isolation of the failed Wallet Runtime.
- Lifecycle tests cover connection-event deduplication, unsupported-chain disconnect deduplication, recoverable failures, and reset behavior after returning to a supported/disconnected state.
- Solana headless-runtime tests drive a fake modern Wallet Standard registry and fake adapters. They cover initial discovery, register/unregister, correct unregister disposal, name deduplication, unsupported filtering, readiness events, fallback preservation, Android Mobile Wallet Adapter conditions, and runtime-scope cleanup.
- Connector-membership tests cover every normative transition in the prototype table, including deferred same-name replacement and disconnect-before-fallback ordering. Assertions use visible connector membership, active connection, UID stability, and disposal effects rather than the private state-machine representation.
- One narrow browser contract evolves the existing WagmiConfigProvider/RainbowKit-facing suite. It verifies fallback-only-during-bootstrap behavior, service-owned config identity, no config replacement after ordinary settings changes, connection actions against the authoritative config, dynamic Solana membership, and readiness propagation through `useConnectors` with a preserved UID.
- The same browser contract includes a Wallet Projection probe so that the service snapshot, read-only atom adapter, and Wagmi-facing hooks are observed together at the integration boundary. Separate tests for deleted binding/controller/state-owning atoms are removed.
- Existing low-level driver and connector tests remain for protocol-specific transaction decoding, signing, broadcasting, account switching, and provider error normalization. They should not duplicate Wallet Runtime orchestration cases.
- Existing runtime-generation tests remain prior art for scoped service identity, cleanup, and remount behavior. Existing WalletService contract tests are prior art for typed Effect commands. Existing Wagmi provider browser tests are prior art for authoritative config identity and RainbowKit-facing actions.
- Good tests assert externally observable behavior and lifecycle ordering. They do not assert private event-loop queue types, internal atom families, connector-wrapper construction helpers, or exact module layout.
- Tests use deterministic fake registries, adapters, providers, and operations. They do not require installed browser wallets, real RPC endpoints, network access, or timing-dependent global discovery.
- Public API and hygiene checks must continue to pass. Services remain free of React dependencies and preserve feature-to-service dependency direction as documented design constraints.

## Out of Scope

- Migrating from legacy `@solana/web3.js` transaction and Connection types to `@solana/client`, `@solana/web3-compat`, or another Solana SDK.
- Adopting `@solana/connector/headless` or replacing the widget's existing adapter contract with ConnectorKit.
- Preserving the deprecated `navigator.wallets` registration path.
- Reconfiguring Wallet Topology in place after Wallet Bootstrap.
- Supporting a runtime transition into or out of external-provider Connector Mode.
- Hot-swapping an active underlying wallet adapter.
- Supporting multiple concurrent widget instances in one document.
- Redesigning wallet modals, connect buttons, account UI, or user-facing copy.
- Changing published package entrypoints or intentionally breaking public React/bundle integrations.
- Persisting Wallet State beyond the existing persistence contracts.
- Shipping the prototype terminal application as production or test code.

## Further Notes

- This specification implements the accepted decision that WalletService owns the Wallet Runtime and follows the repository glossary's Wallet Runtime, Wallet Bootstrap Snapshot, Wallet Topology, Connector Mode, Wallet State, Wallet Projection, External Provider Snapshot, and Wallet Runtime Invariant terminology.
- The Solana research establishes that direct Connection construction, the modern Wallet Standard registry, and adapter readiness events are available without React. It also identifies the installed unregister-handler behavior that must not be copied.
- The connector-membership prototype is a primary-source experiment. It demonstrated real Wagmi core and React observation behavior and discovered the outer-wrapper requirement for readiness updates. Capture it outside the production branch according to the prototype workflow after its decisions are absorbed.
- Access to Wagmi's internal connector store is the main dependency risk. The implementation should characterize that boundary and keep it narrow enough to replace if Wagmi changes its internal API.
- The next planning step is to split this spec into blockers-first tracer-bullet tickets. Each ticket should leave the widget in a working state and should identify which obsolete ownership path it can safely remove.
