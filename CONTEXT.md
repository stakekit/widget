# StakeKit Widget

StakeKit Widget embeds staking and related wallet workflows into a host application. Its wallet context connects host-provided configuration and providers to the accounts and networks available within one widget instance.

## Embedding Language

**Widget Instance**:
A mounted StakeKit Widget within a browser document. A document may contain at most one Widget Instance at a time; unmounting it and later mounting another is supported.
_Avoid_: Concurrent widgets, multiple widget instances

## Wallet Language

**Wallet Scope**:
An immutable snapshot of a connected wallet's network, primary address, and relevant additional addresses for execution inputs. Its owner identity is the network plus primary address (with case-insensitive EVM address comparison); disconnecting or changing that owner invalidates Wallet Scope-bound flows, while additional-address changes alone do not.
_Avoid_: Connector scope

**Wallet Runtime**:
The wallet capabilities and state belonging to one widget application generation. Each generation has an isolated lifetime.

**Wallet Runtime Invariant**:
A condition that must remain true for a Wallet Runtime to safely use its fixed Wallet Topology. A violation indicates an invalid host integration rather than an operational wallet failure.

**Wallet Bootstrap**:
The one-time establishment of Wallet Topology, initial connection behavior, and first Wallet State for a Wallet Runtime. The Wallet Runtime is unavailable until Wallet Bootstrap completes.
_Avoid_: Wallet setup, wallet initialization

**Wallet Bootstrap Snapshot**:
The immutable set of inputs captured together when Wallet Bootstrap begins. It determines Wallet Topology for the lifetime of the Wallet Runtime.
_Avoid_: Current configuration

**Wallet Topology**:
The config-derived chain set, Connector Mode, and connector construction policy of a Wallet Runtime. It is fixed at bootstrap, while environment-discovered connector membership and readiness may change within that policy.
_Avoid_: Wallet configuration

**Connector Mode**:
The mutually exclusive source of connectors selected during Wallet Bootstrap. A Wallet Runtime remains in its initial Connector Mode for its entire lifetime.
_Avoid_: Connector scope, wallet scope

**Wallet State**:
The authoritative current connection, account, chain, and connector-specific details of a Wallet Runtime. Consumers receive Wallet State read-only; `WalletService` owns its changes.

**External Provider Snapshot**:
The latest host-supplied external wallet identity, supported chains, and wallet operations. It may be replaced during a Wallet Runtime without changing Wallet Topology.
_Avoid_: External provider configuration

## Transaction Flow Language

**Classic Transaction Flow**:
The Wallet Scope-bound journey from action review to execution handoff. It has Enter, Exit, Manage, and Activity Resume variants; a widget instance owns at most one active Flow Session, whose captured intake facts remain immutable for that entire journey.
_Avoid_: Classic transaction request

**Flow Session**:
One user attempt to complete a Classic Transaction Flow. Every explicit start creates a fresh Flow Session even when its intake facts equal those of another attempt; Review, Steps, and Complete share that session until the entire journey is exited or replaced.
_Avoid_: Classic Transaction Flow Identity, request object identity

**Action Command**:
The prepared instruction describing the yield action the user intends to perform before that action is created.
_Avoid_: Request DTO

**Action Preview**:
A freshly prepared Yield Action candidate derived from an Action Command and inspected during Review. Continuing to Steps attaches the current candidate to the Flow Session; returning to Review invalidates it for Enter, Exit, and Manage.
_Avoid_: Attached action

**Yield Action**:
The created yield action containing the transactions required to carry out an Action Command. A Flow Session has at most one Yield Action attached at a time; Enter, Exit, and Manage detach it when returning to review and require a freshly prepared action before execution resumes.
_Avoid_: Action DTO

**Classic Transaction Flow Abandonment**:
The end of an active Flow Session when its journey is exited, its Wallet Scope no longer matches, or a new session begins. Returning from execution to review does not abandon the Flow Session; for Enter, Exit, and Manage it removes the prepared Yield Action and requires fresh preparation before execution can resume.
_Avoid_: Request cleanup

**Activity Resume**:
A Classic Transaction Flow that continues an existing Yield Action selected from activity history. Its Flow Session retains that Yield Action when moving between review and execution because it has no Action Command from which to prepare a replacement.
_Avoid_: Activity selection
