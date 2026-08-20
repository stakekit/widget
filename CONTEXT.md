# StakeKit Widget

StakeKit Widget embeds staking and related wallet workflows into a host application. Its wallet context connects host-provided configuration and providers to the accounts and networks available within one widget instance.

## Embedding Language

**Widget Instance**:
A mounted StakeKit Widget within a browser document. A document may contain at most one Widget Instance at a time; unmounting it and later mounting another is supported.
_Avoid_: Concurrent widgets, multiple widget instances

**Application Runtime Generation**:
One continuous lifetime of widget application state created when a Widget Instance mounts and ended when it unmounts. Its current Widget Configuration may change without beginning a new generation.
_Avoid_: Widget Runtime, app mount

**Application API Identity**:
The normalized API key and endpoint set selected from Widget Configuration. Consumers may project it for transport construction; it is not a fixed generation lifetime constraint.
_Avoid_: Runtime Identity, API settings

**Host Configuration**:
The typed configuration supplied by the embedding host. It is trusted at the public boundary and becomes usable only after normalization into Widget Configuration.
_Avoid_: Settings, current configuration

**Widget Configuration**:
The authoritative current configuration of a Widget Instance produced by applying all defaults and normalization to Host Configuration exactly once. Its Wallet Bootstrap Snapshot imposes explicit lifetime constraints; other values may change.
_Avoid_: Host props, runtime identity, settings

**Widget Domain Event**:
An immutable fact that a meaningful occurrence completed within an Application Runtime Generation. Its payload carries the domain identity observers need to determine relevance; it never prescribes an observer mutation.
_Avoid_: Reset signal, Atom instruction, callback

**Widget Maintenance**:
An application-wide unavailable state in which neither presentation variant permits a new user journey. Health recovery restores the current route.
_Avoid_: Dashboard maintenance, maintenance popup

## Wallet Language

**Wallet Network**:
A network for which the Widget can construct and operate a wallet connection. Wallet State and Wallet Scope use only Wallet Networks.
_Avoid_: SupportedSKChains, supported chain

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

**Wallet Command Context**:
An immutable wallet-routing snapshot captured when a wallet command begins. A current account, network, or connector change makes the previous context ineligible for new commands, while an already-started command retains its captured context.
_Avoid_: Current wallet, Wallet Scope

**External Provider Snapshot**:
The latest host-supplied external wallet identity, supported chains, and wallet operations. It may be replaced during a Wallet Runtime without changing Wallet Topology.
Its host-facing contract belongs to Public API; Wallet owns the adapter that executes it.
_Avoid_: External provider configuration

## Token Language

**Token Identity**:
The identity of a token, consisting of its canonical network, exact case-sensitive symbol, and contract address when present. EVM addresses compare case-insensitively, non-EVM addresses compare exactly, and an addressless native token is identified by its network and symbol.
_Avoid_: Token string, token metadata

**Exact Token Amount**:
A token quantity expressed in token units without loss and at a precision no finer than the token's decimals. Amount limits, Max actions, action eligibility, and Action Commands use it; rounded display and fiat values do not.
_Avoid_: Display amount, token balance number, raw amount

**Base Unit Amount**:
A token quantity expressed as an integer count of the token's smallest indivisible unit. Wallet transactions and raw balance facts use it.
_Avoid_: Raw number, decimal amount

## Earn Language

**Earn Catalog**:
The authoritative project-enabled and enterable categories, tokens, yields, and validators available for an Earn journey under the active network and category filters. Initialization parameters and host preferences may select from the Earn Catalog but never expand it.
_Avoid_: Token list, init options, preferred catalog

**Earn Selection**:
The category, token, yield, validators, and entry form values currently resolved for starting an Earn journey. It is valid only against the authoritative facts for the active Wallet Scope Owner.
_Avoid_: Atom state, selected stake data

**Earn Selection Reconciliation**:
The deterministic comparison of the previous Earn Selection, current Entry Intent, initialization seed, live preferences, and current Earn Catalog. It preserves previously resolved values while they remain valid, may retain the previous selection as ineligible presentation while Wallet State is unresolved, and replaces values invalidated by a confirmed Wallet Scope Owner or authoritative fact without writing derived choices into Entry Intent.
_Avoid_: State synchronization, intent repair, projection write

**Yield Entry**:
A user's pre-execution attempt to add tokens to an Earn Selection. An eligible Yield Entry culminates in an Enter Action Command.
_Avoid_: Enter Action, stake form

**Yield Entry Readiness**:
The closed submission-availability state supplied by an entry surface to Yield Entry: Loading, Empty, Ineligible, Refreshing, or Ready. Yield Entry combines it with its internally owned Wallet, Widget Configuration, KYC, and provider facts; Refreshing retains presentation data but temporarily prevents submission.
_Avoid_: Loading flags, can submit, page readiness

**Yield Entry Amount Initialization**:
The explicit policy for deriving the displayed amount from Entry Intent: Preserve Intent or Default to Minimum. It changes only a zero intent when the selected yield has a positive allowed minimum.
_Avoid_: Default amount flag, prefilled stake amount

**Earn Initialization**:
The one-time capture of host or deep-link parameters into a seed for the first Earn Selection after Wallet Bootstrap settles. Capture consumes the initialization for that Widget Instance; the seed may wait for the Earn Catalog, but leaving its entry surface, changing its owner, or making an explicit selection abandons it without replay.
_Avoid_: Permanent default, init fallback

**Unknown Earn Balance**:
The absence of usable wallet balance data for a canonical Earn token. It is distinct from a zero balance: the token remains available for browsing, while amount-dependent Yield Entry is ineligible.
_Avoid_: Zero balance, missing token

**Earn Readiness**:
The condition in which each authoritative fact required by the current resolved Earn path has a usable value and submission eligibility can be determined. Initial token selection waits for the Earn Catalog and first balance attempt; later pagination or refresh with a retained usable value does not end Earn Readiness.
_Avoid_: Page loaded, no spinner

**Blocking Earn Failure**:
The absence of usable data after an authoritative resource required by the current resolved Earn path fails. Failures in unselected categories and wallet balance enrichment are not blocking while the Earn Catalog remains usable.
_Avoid_: Failure stage, retry target, catalog operation error

**Earn Mechanic Arguments**:
The yield-advertised action inputs whose constraints and options determine additional Earn form and transaction values. Only arguments understood by the Widget participate in Earn Selection.
_Avoid_: Raw mechanic fields, yield contract

**Validator Address Identity**:
The network-sensitive identity of a validator address. EVM validator addresses compare case-insensitively while non-EVM validator addresses compare exactly; the original address remains the action and presentation value.
_Avoid_: Normalized validator address, validator string

**Validator Policy**:
The network-specific or wildcard Host Configuration that constrains which validators are eligible or preferred for an Earn Selection.
_Avoid_: Validators config, validator filter

**Eligible Validator**:
A validator that satisfies the selected yield's requirements and its current Validator Policy.
_Avoid_: Available validator, visible validator

**Wallet Scope Owner**:
The owner identity of a Wallet Scope, consisting only of its network and primary address. Additional-address changes do not change the Wallet Scope Owner.
_Avoid_: Wallet Scope key, connector identity

## Borrow Language

**Native Borrow Token**:
A Borrow collateral or loan token representing a chain-native asset without a contract address. It is valid Borrow catalog data rather than a malformed addressed token.
_Avoid_: Empty-address token

**Borrow Entry**:
The journey for selecting a Borrow market, entering borrow and collateral
amounts, and preparing a new or expanded Market Position. Its intent belongs to
the Wallet Scope Owner and survives additional-address changes while its
authoritative facts and eligibility are recalculated.
_Avoid_: Borrow dashboard, borrow form flow

**Borrow Account Snapshot**:
The decoded API snapshot of one wallet owner's Borrow balances and provider-reported risk facts for an integration and network. It is an input to derivation, not the application's position model.
_Avoid_: Position, account position

**Market Position**:
One existing Borrow position in a specific market. It owns only that market's balances, pending actions, and local financial metrics, and references the Risk Position that governs those balances.
_Avoid_: Position, account position

**Market Debt**:
The debt attributed to one Market Position. A repayment Review's Debt transition is Market Debt even when an account-wide Risk Position governs the pooled account.
_Avoid_: Total account debt

**Borrow Positions**:
The wallet-scoped aggregate of existing Market Positions and the resolver for the Risk Position governing any catalog market, including a selected market with no existing Market Position.
_Avoid_: Position items, positions array

**Risk Position**:
The domain-owned solvency view for either a pool account or one isolated market. It exposes current risk and assesses semantic compound changes such as borrow, repay, supply, withdraw, and collateral toggles using their effective protocol amounts. When a fee-bearing Action Command carries a gross wallet debit, risk assessment uses the net amount credited as collateral.
_Avoid_: Risk scope, risk helpers, position projection

**Account Risk Position**:
A Risk Position shared by pool Market Positions for one integration and network. Its current facts are API-authoritative; projected facts use the Widget's complete known collateral composition.

**Market Risk Position**:
A Risk Position owned by one isolated market. Its current facts use the market's API-authoritative position state.

**Risk Unavailable**:
A typed, user-visible result meaning the Widget lacks consistent inputs for a risk projection. It does not block an action; known projected borrow-capacity violations do.
_Avoid_: Infinite limit, safe fallback

## Portfolio Language

**Portfolio Completeness**:
Whether every position source active for the current Wallet Scope has usable data. An incomplete portfolio may show retained positions but is neither empty nor fully known.
_Avoid_: Loaded positions, empty positions

## Transaction Flow Language

**Entry Intent**:
User-authored pre-execution values retained only while their entry surface is active for the current Wallet Scope Owner. Leaving that surface, changing or disconnecting its owner, or starting any Transaction Workflow for that owner consumes the intent; additional-address-only changes preserve it.
_Avoid_: Form state, draft Atom

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

**Action Argument Contract**:
The authoritative required and optional inputs for one action, supplied by its owning domain source such as Earn mechanics, a pending action, or a Borrow action definition. A Transaction Flow may enter Review only with an Action Command that satisfies it, including present required scalars and non-empty required collections.
_Avoid_: Best-effort arguments, Earn-only mechanics

**Action Command**:
The prepared instruction describing the protocol action the user intends to perform before that action is created.
_Avoid_: Request DTO

**Exit Receive Token**:
The asset a user elects to receive from an Exit Action. It is independent of the position token and the token originally used to enter the position.
_Avoid_: Deposit token, position token, output token

**Action Preview**:
A freshly prepared Yield Action candidate derived from the Flow Session intake and inspected during Review. An executable Action Preview contains no terminal-failure transactions, and terminal-success skipped transactions do not enter execution; continuing promotes the candidate into one Execution attempt, while returning to Review always requires a fresh candidate.
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

**Transaction Workflow Started**:
A Widget Domain Event stating that a Transaction Workflow was successfully constructed for a Wallet Scope Owner. It marks all Entry Intent belonging to that owner as consumed, independent of journey type.
_Avoid_: Form reset signal, journey outcome

**Transaction Workflow Ended**:
A Widget Domain Event stating that a Transaction Workflow's scoped lifetime ended, whether completed or abandoned. It is emitted once when its Execution Attempt is left.
_Avoid_: Navigation event, invalidation command

**Post-Transaction Reconciliation**:
A Wallet Scope Owner-bound effort to reconcile authoritative balances and positions after a Transaction Workflow ends. A newer reconciliation effort replaces the current one, and disconnecting or changing its owner ends it.
_Avoid_: Refresh workflow, polling workflow

**Classic Transaction Flow Abandonment**:
The end of an active Flow Session when its journey is exited, its Wallet Scope no longer matches, or a new session begins. Returning from execution to Review ends only the current Execution Attempt and does not abandon the Flow Session.
_Avoid_: Request cleanup

**Activity Resume**:
A Classic Transaction Flow started from a Yield Action selected in activity history. Review reconstructs a fresh Action Preview when the historical action contains enough intake, and execution routes remain valid only for the captured action type; unsupported historical actions remain non-executable.
_Avoid_: Activity selection
