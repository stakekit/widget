# StakeKit Widget

StakeKit Widget embeds staking and related wallet workflows into a host application. Its wallet context connects host-provided configuration and providers to the accounts and networks available within one widget instance.

## Embedding Language

**Widget Instance**:
A mounted StakeKit Widget within a browser document. A document may contain at most one Widget Instance at a time; unmounting it and later mounting another is supported.
_Avoid_: Concurrent widgets, multiple widget instances

## Wallet Language

**Wallet Scope**:
An immutable snapshot of a connected wallet's network, primary address, and relevant additional addresses for execution inputs. Its owner identity is the network plus primary address (with case-insensitive EVM address comparison); a prepared action can enter execution only when its owner matches the captured Wallet Scope, and disconnecting or changing that owner invalidates Wallet Scope-bound flows while additional-address changes alone do not.
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

**Transaction Flow**:
A Wallet Scope-bound user journey through Review, Steps, and Complete, owned by one fresh Flow Session. Classic and Borrow Transaction Flows share this lifecycle language while retaining distinct intake, action preparation, and execution behavior.
_Avoid_: Transaction Workflow, shared flow implementation

**Classic Transaction Flow**:
The Wallet Scope-bound journey from action review to execution handoff. It has Enter, Exit, Manage, and Activity Resume variants; a widget instance owns at most one active Flow Session, whose captured intake facts remain immutable for that entire journey.
_Avoid_: Classic transaction request

**Borrow Transaction Flow**:
The Wallet Scope-bound journey from prepared borrow-action intake through Review, action creation, execution, and Complete. Borrow market and position actions enter through the same flow while retaining their distinct immutable intake facts.
_Avoid_: Borrow workflow, borrow dashboard flow

**Flow Session**:
One user attempt to complete a Transaction Flow. Every explicit Start creates a fresh Flow Session even when its intake facts equal those of another attempt; Review, Steps, and Complete share its immutable intake and Wallet Scope until the entire journey is exited or replaced.
_Avoid_: Transaction Flow Identity, request object identity

**Action Command**:
The prepared instruction describing the yield action the user intends to perform before that action is created.
_Avoid_: Request DTO

**Action Preview**:
A freshly prepared Yield Action candidate derived from the Flow Session intake and inspected during Review. Continuing promotes that candidate into one Execution attempt; returning to Review always requires a fresh candidate.
_Avoid_: Attached action, prepared action

**Yield Action**:
The created yield action containing the transactions required to carry out an Action Command. A Flow Session hands at most one reviewed Yield Action into its current Execution attempt.
_Avoid_: Action DTO

**Execution Attempt**:
The Steps-and-Complete portion of a Flow Session for one reviewed action. It owns one Transaction Workflow and ends permanently when execution is left; a later execution always creates a fresh attempt.
_Avoid_: Executable phase, attached action

**Transaction Workflow**:
A single execution of a prepared transaction plan, covering signing, submission, confirmation, multi-step advancement, retry, and completion. It is fresh each time an action enters execution and ends permanently when that execution is left, even when a later execution has equal inputs.
_Avoid_: Workflow identity, resumable workflow, workflow family

**Classic Transaction Flow Abandonment**:
The end of an active Flow Session when its journey is exited, its Wallet Scope no longer matches, or a new session begins. Returning from execution to Review ends only the current Execution Attempt and does not abandon the Flow Session.
_Avoid_: Request cleanup

**Activity Resume**:
A Classic Transaction Flow started from a Yield Action selected in activity history. Review reconstructs a fresh Action Preview when the historical action contains enough intake; unsupported historical actions remain non-executable.
_Avoid_: Activity selection
