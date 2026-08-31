# Shared Networks are the backend intersection

A Network used in shared Widget domain data must be declared by both the Legacy
and Yield backends. The domain Network module composes their generated schemas
as an intersection rather than trusting either backend alone or admitting their
union, so a one-sided rollout cannot enter shared domain state before both
required product-data sources support it. The public interface imports the
Network type through the Domain Network contract rather than declaring a
mirror.

Wallet Bootstrap obtains the current project's enabled network IDs from the
Yield API and narrows them to Wallet Networks. It does not consult or fall back
to the Legacy enabled-networks endpoint.

One wallet-domain catalogue declares Wallet Network support. Its keys define
Wallet Network, and its values provide each Wallet Network's protocol family,
Wallet Routing ID, and a discriminated Protocol Chain Identity. Every Wallet
Network has a routing ID; Protocol Chain Identity may be explicitly unmodelled
when the Widget does not currently possess a genuine protocol-native identity.
Synthetic routing IDs are not treated as native identities. Protocol family is
intrinsic; adapter ownership and transaction-driver selection are not. `misc`
is an aggregation bucket rather than a protocol family, adapter, or transaction
driver.

Individual adapters own their full chain and connector configuration and
declare their supported-network coverage independently. Existing EVM chain IDs,
Cosmos `chain_id` values, Substrate genesis hashes, and Widget-assigned routing
IDs move into the catalogue and feed adapter configuration. RPC endpoints,
currency metadata, icons, address configuration, and connector construction
remain adapter-owned. Connector modes such as Ledger Live and External Provider
may route across protocol families. The Widget does not maintain an exhaustive
category mapping for Networks that are not Wallet Networks.

Existing public chain-ID names and values remain compatibility interfaces and
are exported through the Domain contract as dependency-free `as const` objects
with same-name value-union types. Forward access such as
`EvmChainIds.Ethereum` and exhaustive chain-ID typing remain supported. Numeric
enum reverse lookup is intentionally removed. `MiscChainIds` remains a
compatibility name and does not define the Domain taxonomy. `initialChain`
remains numeric; broadening it to non-numeric Wallet Routing IDs is a separate
product-interface change.

External Provider transaction support remains an adapter-owned capability set.
The compatibility-preserving migration does not narrow the existing public
`SupportedSKChainIds` properties; doing so is a separate breaking-interface
decision.

Stellar mainnet is the only Wallet Network in the `stellar` protocol family.
Its Stellar Network Passphrase is its Protocol Chain Identity. Backend schemas
may still enumerate Stellar testnet, but Wallet Bootstrap narrows it out because
the wallet-domain catalogue does not declare it. The Widget-assigned numeric
routing ID remains a private adapter detail rather than an addition to
`MiscChainIds`, `SupportedSKChainIds`, `initialChain`, or External Provider
contracts. Built-in Stellar wallet support does not imply Stellar support for
host-supplied External Providers.
