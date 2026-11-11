# StakeKit Widget

An embeddable widget that lets a wallet owner discover yields, enter and manage
yield positions, and borrow against collateral. Use these names in code, tests,
issues, and discussions; this file defines vocabulary, not implementation.

## Language

### Embedding

**Widget Instance**: A mounted StakeKit Widget within a browser document. The
Widget is designed for one instance at a time, though concurrent mounts are not
blocked at runtime; sequential instances are fully supported.

**Application Runtime Generation**: The continuous application-state lifetime
from a Widget Instance's mount through its unmount.

**Host Configuration**: The typed values supplied by the embedding host.

**Widget Configuration**: The normalized, authoritative current configuration
derived from Host Configuration. Application API Identity and Borrow enablement
keep their mount values for the Application Runtime Generation.

**Application API Identity**: The normalized API key and endpoint set, fixed at
mount for the Application Runtime Generation.

**Host Profile**: The named capabilities a host variant enables, such as the
Earn presentation, terms-of-service acknowledgement, or wallet catalogue, plus
the Appearance Preset and Presentation Setting overrides that give the host its
look. Features read capabilities, never variant names, and never style by host
variant.

**Layout**: The page arrangement a Widget Instance presents: the Compact Layout
or the Dashboard Layout, chosen by the host's `layout` option. It is independent
of the host variant. Its visual differences reach the Design System as
Presentation Settings.
_Avoid_: variant, flavour, classic

**Compact Layout**: The single-column Layout that shows one page at a time
under the widget header, with Earn, positions, and activity as tabs.
_Avoid_: classic, widget variant

**Dashboard Layout**: The wide Layout with Yield Category, Borrow, Manage, and
Activity tabs, showing details beside the page.
_Avoid_: dashboard variant

**Widget Domain Event**: An immutable fact that a meaningful occurrence
completed. It carries identity for observers but does not prescribe a mutation.

**Widget Maintenance**: The application-wide state in which new user journeys
are unavailable.

### Design System

**Design System**: The Owned Module that holds every visual decision of the
Widget: tokens, themes, the scoped reset, primitives, components, patterns,
icons, and artwork. Features and application composition build UI only by
composing it.
_Avoid_: shared UI, component library

**Appearance**: The host's semantic description of the Widget's look: a color
scheme (`light`, `dark`, or `system`), Color Roles for each scheme, and radius,
control-height, font, and weight settings. It applies live and beats the Host
Profile's Appearance Preset and any legacy theme.
_Avoid_: theme, theme tokens

**Color Role**: A named semantic color every Design System part reads, such as
`surface`, `textMuted`, or `accent`, with a value per color scheme. Hosts may
set any Color Role; derived roles such as `accentHover` follow their base role
unless set.
_Avoid_: color token, palette color

**Appearance Preset**: A Design System-owned set of Appearance values that a
Host Profile names to give a partner host its look. It may fix the color
scheme.
_Avoid_: skin, host theme

**Presentation Setting**: A named visual choice, such as call-to-action size,
gutter, tabs indicator, or surface style, resolved from the Layout's defaults
and the Host Profile's overrides and applied by the Design System. It is named
after the difference, never after a Layout or host.
_Avoid_: Layout style, variant style

### Wallet

**Network**: A canonical blockchain or protocol network identity supported
across the Widget's shared product data.

**Enabled Wallet Networks**: The active project Networks reported by Yield and
narrowed to Wallet Networks when Wallet Bootstrap begins.

**Wallet Network**: A Network on which the Widget can construct and operate a
wallet connection.

**Protocol Chain Identity**: A Network's native identity within its protocol,
such as an EVM numeric chain ID, Cosmos string chain ID, or Substrate genesis
hash.

**Wallet Routing ID**: The identifier wallet integrations use to select a
Wallet Network. It may be protocol-native or assigned by the Widget.

**External Provider Chain ID**: A numeric Wallet Routing ID accepted by an
External Provider. It exists only for the External Provider's supported Wallet
Networks.

**Wallet Runtime**: Wallet capabilities and state belonging to one Application
Runtime Generation.

**Wallet Bootstrap**: The one-time establishment of Wallet Topology and initial
Wallet State. The Wallet Runtime is unavailable until it completes.

**Wallet Bootstrap Snapshot**: The immutable inputs captured together when
Wallet Bootstrap begins.

**Wallet Topology**: The network set, Connector Mode, and connector-construction
policy fixed by the Wallet Bootstrap Snapshot.

**Wallet Policy**: Host Configuration that filters, orders, and groups the
wallets available within the fixed Wallet Topology.

**Connector Mode**: The mutually exclusive source of connectors selected at
Wallet Bootstrap.

**Wallet State**: The authoritative current connection, account, network, and
connector details owned by the wallet service.

**Wallet Scope**: An immutable execution snapshot of a Wallet Scope Owner and
relevant additional addresses. It can remain available while Wallet State is
connecting.

**Wallet Scope Owner**: A Wallet Scope's network and primary address. EVM
addresses compare case-insensitively; additional addresses are not owner
identity.

**Wallet Command Context**: The wallet-routing snapshot captured when a command
begins. A started command retains it even if current Wallet State changes.

**WalletConnect Protocol Client**: The single Widget-owned WalletConnect client
that proposes, restores, requests on, and disconnects non-EVM WalletConnect
sessions. Each session belongs to one namespace and one topic.

**WalletConnect Presentation**: The display of a pending pairing URI as a QR
code, wallet explorer, or wallet deep link. It never owns protocol sessions.

**External Provider Snapshot**: The latest host-supplied external wallet
identity, supported networks, and operations.

**Cancelled Wallet Request**: A connection, signature, or transaction request
the user declined in their wallet. It is reported as cancelled, never as a
failure.
_Avoid_: rejection, rejected request

### Tokens and amounts

**Token Identity**: Canonical network, exact symbol, and contract address when
present. EVM addresses compare case-insensitively; non-EVM addresses compare
exactly.

**Exact Token Amount**: A lossless quantity in token units at no finer precision
than the token's decimals. Eligibility and Action Commands use this value.

**Base Unit Amount**: An integer count of a token's smallest indivisible unit.
Wallet transactions and raw balances use this value.

**Value Token**: The token a position balance's amount is quoted and priced in:
the yield's underlying asset. A balance's value always carries it.
_Avoid_: base token, underlying token

**Shares**: A position balance's amount in its share token, such as vault
shares or a wrapped token, when that token differs from its Value Token.
_Avoid_: holding, receipt balance

**Exit Unit**: The token an exit amount is entered in: the share token when the
exit's Action Argument Contract takes only Shares, not a plain amount;
otherwise the Value Token.

**Exit Receive Token**: The token an exit pays out, chosen from the exit's
advertised options.
_Avoid_: output token (in copy)

### Earn

**Earn Catalog**: The authoritative project-enabled, enterable categories,
tokens, yields, and validators under the current filters, plus any
**Display-only Yields** the project offers.

**Display-only Yields**: A fixed set of yields closed to deposits that the
Earn Catalog still lists; entry stays disabled until the yield reopens.

**Earn Selection**: The category, token, yield, validators, and entry values
currently resolved for an Earn journey.

**Earn Selection Reconciliation**: The deterministic resolution of the current
Earn Selection from prior selection, Entry Intent, initialization, preferences,
Wallet Scope Owner, and Earn Catalog.

**Earn Initialization**: The one-time capture of host or deep-link parameters
for the first Earn Selection after Wallet Bootstrap settles.

**Earn Readiness**: The condition in which every authoritative fact required by
the resolved Earn path has a usable value.

**Yield Entry**: A user's pre-execution attempt to add tokens to an Earn
Selection.

**Yield Entry Readiness**: The closed availability state Loading, Empty,
Ineligible, Refreshing, or Ready supplied by an entry surface.

**Unknown Earn Balance**: Absence of usable balance data for an Earn token. It
is distinct from a known zero balance.

**Validator Policy**: Host Configuration that constrains eligible or preferred
validators for a network.

**Yield Category**: A kind of yield (staking, DeFi, or real-world assets) by
which yields are grouped, ordered, and filtered.
_Avoid_: dashboard category

**Yield Provider Order**: Host Configuration that ranks yield providers within
each Yield Category, ordering that category's yields and its default yield.
It ranks yields, never validators.

**Eligible Validator**: A validator satisfying the selected yield's
requirements and current Validator Policy.

**Yield Reward Rate**: The current rate advertised for a yield, independent of
validator choice.

**Validator Reward Rate**: The current rate belonging to one Eligible Validator.

**Effective Reward Rate**: The rate for the current Earn Selection: the
unweighted mean of selected validators with rates, otherwise the Yield Reward
Rate.

**Reward Rate History**: A yield-scoped time series of Yield Reward Rate
snapshots, not validator or Effective Reward Rates.

**Campaign**: A project-scoped, sponsor-funded incentive on one yield, with a
budget, schedule, minimum-balance rule, per-wallet cap, and payout cadence.
Only the newest live Campaign of a yield adds to its Yield Reward Rate.
_Avoid_: boost, promotion

**Campaign Incentive Rate**: The `campaign_incentive` part of a Yield Reward
Rate, an APR the API already reduces for the campaign's ceiling. The widget
shows it as given and never recomputes a cap.

**Campaign Lifecycle**: Upcoming, active, ending soon (under 14 days left),
paused, or ended, derived from the API status, the start and end times, and the
presentation clock. An ended Campaign is never shown on Earn.

**Campaign Rate Ceiling**: The highest rate a Campaign lets a yield reach:
the campaign rate alone (`incentive` mode) or the yield's own rate plus it
(`combined`). Milestones step it, so reaching one replaces it. Not the
per-wallet cap, which limits the balance that earns.
_Avoid_: APY cap (in code)

### Confidential vaults

**Confidential Vault**: A yield whose position balances are encrypted on-chain,
so only the Wallet Scope Owner can read their amounts.

**Confidential Token**: The encrypted counterpart of an underlying token, held
and transferred without revealing amounts.

**Confidential Handle**: The on-chain reference to one encrypted amount. The API
returns it in place of an encrypted balance's amount; a changed amount has a new
handle.
_Avoid_: ciphertext, encrypted value

**Revealed Balance**: An encrypted amount the Wallet Scope Owner decrypted for
display. It is held in memory only and forgotten on hide or account change.
_Avoid_: cleartext, decrypted value, confidential value

**Hidden Token Balance**: A wallet's Confidential Token balance, which the API
cannot read. It is an Unknown Earn Balance until revealed.

**Confidential Conversion**: The Direct Transactions that turn an underlying
token into its Confidential Token before a deposit: an optional Allowance
Reset, an approval, and a wrap.

**Allowance Reset**: An approval to zero sent before a new approval, because
some tokens refuse to change one non-zero allowance to another.

**Action Preparation**: The creation of a Confidential Vault's Yield Action on
Steps, after confirmation, from an Action Command with its amount encrypted or
its withdrawal decrypted. It takes the place of an Action Preview.

**Instant Exit**: A Confidential Vault exit paid out in the underlying token
right away, its amount public: it unwraps the vault shares, then an Unwrap
Finalize withdraws and redeems them. A **Private Exit** instead joins the next
redemption batch and pays out the Confidential Token.

**Unwrap Finalize**: The second Action Preparation of an Instant Exit, in the
same workflow once its unwrap confirms: it waits for the API to list the unwrap
request, decrypts its amount, and prepares the WITHDRAW that completes it.
_Avoid_: follow-up

**Planned Step**: A step Steps lists before the API returns it, so the whole
confidential flow shows from confirmation; it never signs.

**In-flight Cancel**: A CANCEL_PENDING action broadcast but not yet confirmed;
its pending balance shows as cancelling, matched by the position's handle.

### Borrow

**Borrow Network**: A Wallet Network on which the Widget offers Borrow markets
and can prepare Borrow actions.

**Borrow Entry**: The journey for selecting a market, entering borrow and
collateral amounts, and preparing a new or expanded Market Position.

**Borrow Account Snapshot**: The decoded provider snapshot of one wallet
owner's balances and risk facts for an integration and network.

**Market Position**: An existing Borrow position in one market, including its
balances, Pending Actions, local metrics, and governing Risk Position.

**Market Debt**: Debt attributed to one Market Position, even when account-wide
risk governs the pool.

**Borrow Positions**: The Wallet Scope aggregate of Market Positions and the
resolver for the Risk Position governing a catalog market.

**Risk Position**: The solvency view for either a pooled account or isolated
market, including semantic projections for proposed changes.

**Account Risk Position**: A Risk Position shared by pooled Market Positions for
one integration and network.

**Market Risk Position**: A Risk Position owned by one isolated market.

**Risk Unavailable**: A typed absence of consistent inputs for a risk
projection. It is not a warning, blocker, or substitute metric: the Borrow
form keeps its LTV and health factor rows, reading "—" with a caption saying
the projection couldn't be computed.

**Borrow Constraint Warning**: A known liquidity, balance, debt-minimum, or
capacity violation attached to a constructible Action Command for review. It
never blocks; the provider or blockchain remains authoritative at execution.

**Risk Gate**: The single allow, warn, or block decision for a proposed Borrow
change, made from its Risk Position projection. It is the only widget-side
block and blocks only changes the protocol would reject; Risk Unavailable
allows.

**Risk Band**: How close a position with debt sits to liquidation: safe,
caution (health factor below 1.5, or LTV within 90% of max LTV) or danger
(health factor below 1.1, or LTV past max LTV). One band, the worse of the two
figures, tones the LTV, its meter and the health factor alike: safe reads
plain, caution as a warning, danger as danger; caution and danger raise an
alert with Repay, and a status on the position's Manage row ("Close to
liquidation", "High liquidation risk") that sorts it first and counts it in
the Manage tab. It informs only; the Risk Gate decides.

**Action Rejection Reason**: The API's own message when it refuses to create an
action. Review shows it in place of generic failure copy.

### Errors

**API Request Failure**: A failure of one API request, normalized once at the
API boundary into a typed outcome: unreachable, invalid request, error status
with its presentable body, or unreadable response. Consumers read that outcome,
never the client's original error.

**Rich Error**: A schema-validated, presentable failure detail: the API's body
for an error status, or the widget's no-answer detail when the API never
answered. Other API Request Failures are not presented.

**Rich Error Identity**: A stable error name used to find Error Copy; it is not
user-facing text.

**Error Copy**: The user-facing title, details, and solution for one Rich Error
Identity.

**Remote Error Catalog**: The hosted collection of Error Copy keyed by Rich
Error Identity.

**Local Error Fallback**: Widget-owned Error Copy used when the Remote Error
Catalog lacks an identity.

### Portfolio

**Portfolio Completeness**: Whether every position source active for the current
Wallet Scope has usable data. An incomplete portfolio may retain positions but
is neither empty nor fully known.

**Pending Action**: An action a position balance currently offers, such as
claiming rewards, withdrawing, or cancelling a pending deposit.

### Transactions

**Entry Intent**: User-authored pre-execution values retained for an active entry
surface and Wallet Scope Owner.

**Transaction Flow**: A Wallet Scope-bound journey through Review, Steps, and
Complete. Yield and Borrow Transaction Flows share the lifecycle machinery
(handoff, Execution start, Session mount); each owns its payloads,
destinations and completion rule.

**Yield Transaction Flow**: A Transaction Flow that enters, exits, or manages a
yield position through a Yield Action.
_Avoid_: classic flow

**Borrow Transaction Flow**: A Transaction Flow that applies a Borrow action to
a new or existing Market Position.

**Review**: The Transaction Flow stage where the user inspects what will happen
and confirms it.

**Steps**: The Transaction Flow stage that shows each transaction's progress
while a Transaction Workflow runs.

**Complete**: The Transaction Flow stage shown once its Transaction Workflow
completes.

**Manage**: A Yield Transaction Flow that runs one Pending Action on a
position balance.

**Flow Session**: One user attempt to complete a Transaction Flow, with immutable
intake and Wallet Scope from Review through Complete.
_Avoid_: session

**Action Argument Contract**: The authoritative required and optional inputs for
one action.

**Action Command**: A prepared instruction describing the protocol action the
user intends before the action is created.

**Action Preview**: A freshly prepared action candidate inspected during Review.

**Yield Action**: The created yield action and transactions required to carry
out an Action Command.

**Handoff**: What Review gives Steps on confirmation: a previewed Yield Action,
a Confidential Vault's Action Preparation and Confidential Conversion, or a
created Borrow action. A Flow Session holds at most one, waiting for Steps or
running.
_Avoid_: confirmation, source

**Execution**: The Steps-and-Complete portion of a Flow Session for one
Handoff.
_Avoid_: Execution Attempt

**Leave Confirmation**: The question asked before a user action in the Widget
ends a leave-guarded Execution, one whose Transaction Workflow has work under
way: a wallet request in flight, or a transaction signed, sent, or done.
Leaving abandons its remaining transactions.

**Transaction Workflow**: One execution of a transaction plan, including Action
Preparation, signing, submission or broadcast, confirmation, advancement,
retry, and completion.
_Avoid_: engine, executor

**Direct Transaction**: A transaction the Widget builds and broadcasts itself,
which no Yield Action records.
_Avoid_: conversion step, widget transaction

**Direct Transaction Ledger**: A Flow Session's record of the Direct
Transactions it sent and confirmed, so a later Execution resumes them instead
of sending them again.

**Held Hash**: A broadcast hash the API had not yet acknowledged when its
Transaction Workflow ended, including one a wallet returns only after the
workflow ended. The Widget still registers it.

**Post-Transaction Reconciliation**: A Wallet Scope Owner-bound refresh of
authoritative balances and positions after a Transaction Workflow ends.

**Activity**: The Wallet Scope Owner's feed of recent Yield Actions and their
details.

**Continuable Yield Action**: A Yield Action waiting for its next step that is
still recent enough to continue.

**Yield Action Continuation**: A Yield Transaction Flow confirmed from an
Activity details Review for a Continuable Yield Action. It executes the existing
Yield Action without creating an Action Preview or another Yield Action.
