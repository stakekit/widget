# The Widget owns the WalletConnect protocol for non-EVM families

Every non-EVM WalletConnect wallet (Solana, Stellar, Tron, Cosmos, and
Substrate) uses one Widget-owned WalletConnect Protocol Client: a single
`@walletconnect/sign-client` instance with the `stakekit-walletconnect` storage
prefix, created lazily and scoped to the Wallet Runtime. Family libraries own
only their extension and injected wallets. A family's WalletConnect wallet is a
small owned adapter that maps the family's account and signing interface to
that namespace's JSON-RPC methods, restores unexpired sessions on reload, and
disconnects only its own session topic.

Library-provided WalletConnect clients each created their own client with
different SDK versions and storage prefixes, and each carried its own defects:
default-prefix storage shared with unrelated clients, sessions that could not be
restored, blanket pairing deletion, URI polling, and remote session ends that
never reached wagmi. Owning the protocol costs a few hundred lines of adapter
code per family. It makes session isolation, restoration, and cancellation one
implementation instead of one per library.

EVM WalletConnect stays on wagmi's `walletConnect` connector with the
`clientTwo` prefix. It already handles chain switching and EIP-1193 events, and
keeping the prefix preserves existing sessions. Move EVM onto the owned client
only if that connector becomes a source of defects.

Reown AppKit is only the WalletConnect presentation: it shows the pairing URI
and wallet explorer through manual WalletConnect control. It receives its own
inert `UniversalProvider` with the `stakekit-appkit-presentation` prefix,
because AppKit otherwise creates a default-prefix provider, observes and
patches the provider it is given, and refuses to open while it believes it is
connected. No protocol session ever passes through AppKit.
