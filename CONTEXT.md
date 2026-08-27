# StakeKit Widget Domain Glossary

Use these names in code, tests, issues, and discussions. This file defines
project vocabulary, not implementation structure.

## Embedding

**Widget Instance**: A mounted StakeKit Widget within a browser document. A
document may contain one Widget Instance at a time; sequential instances are
supported.

**Application Runtime Generation**: The continuous application-state lifetime
from a Widget Instance's mount through its unmount.

**Host Configuration**: The typed values supplied by the embedding host.

**Widget Configuration**: The normalized, authoritative current configuration
derived from Host Configuration.

**Application API Identity**: The current normalized API key and endpoint set.

**Widget Domain Event**: An immutable fact that a meaningful occurrence
completed. It carries identity for observers but does not prescribe a mutation.

**Widget Maintenance**: The application-wide state in which new user journeys
are unavailable.

## Wallet

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

**External Provider Snapshot**: The latest host-supplied external wallet
identity, supported networks, and operations.

## Tokens and amounts

**Token Identity**: Canonical network, exact symbol, and contract address when
present. EVM addresses compare case-insensitively; non-EVM addresses compare
exactly.

**Exact Token Amount**: A lossless quantity in token units at no finer precision
than the token's decimals. Eligibility and Action Commands use this value.

**Base Unit Amount**: An integer count of a token's smallest indivisible unit.
Wallet transactions and raw balances use this value.

## Earn

**Earn Catalog**: The authoritative project-enabled, enterable categories,
tokens, yields, and validators under the current filters.

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

## Borrow

**Borrow Network**: A Wallet Network on which the Widget offers Borrow markets
and can prepare Borrow actions.

**Borrow Entry**: The journey for selecting a market, entering borrow and
collateral amounts, and preparing a new or expanded Market Position.

**Borrow Account Snapshot**: The decoded provider snapshot of one wallet
owner's balances and risk facts for an integration and network.

**Market Position**: An existing Borrow position in one market, including its
balances, pending actions, local metrics, and governing Risk Position.

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
projection. It is not a warning, blocker, or substitute metric.

**Borrow Constraint Warning**: A known liquidity, balance, debt-minimum, or
capacity violation attached to a constructible Action Command for review. The
provider or blockchain remains authoritative at execution.

## Errors and portfolio

**API Request Failure**: A normalized failure of one Effect API request.

**Rich Error**: A schema-validated, presentable API failure detail.

**Rich Error Identity**: A stable API error name used to find Error Copy; it is
not user-facing text.

**Error Copy**: The user-facing title, details, and solution for one Rich Error
Identity.

**Remote Error Catalog**: The hosted collection of Error Copy keyed by Rich
Error Identity.

**Local Error Fallback**: Widget-owned Error Copy used when the Remote Error
Catalog lacks an identity.

**Portfolio Completeness**: Whether every position source active for the current
Wallet Scope has usable data. An incomplete portfolio may retain positions but
is neither empty nor fully known.

## Transactions

**Entry Intent**: User-authored pre-execution values retained for an active entry
surface and Wallet Scope Owner.

**Transaction Flow**: A Wallet Scope-bound journey through Review, Steps, and
Complete. Classic and Borrow flows share lifecycle language, not implementation.

**Flow Session**: One user attempt to complete a Transaction Flow, with immutable
intake and Wallet Scope from Review through Complete.

**Action Argument Contract**: The authoritative required and optional inputs for
one action.

**Action Command**: A prepared instruction describing the protocol action the
user intends before the action is created.

**Action Preview**: A freshly prepared action candidate inspected during Review.

**Yield Action**: The created yield action and transactions required to carry
out an Action Command.

**Execution Attempt**: The Steps-and-Complete portion of a Flow Session for one
reviewed action.

**Transaction Workflow**: One execution of a prepared transaction plan,
including signing, submission, confirmation, advancement, retry, and completion.

**Post-Transaction Reconciliation**: A Wallet Scope Owner-bound refresh of
authoritative balances and positions after a Transaction Workflow ends.

**Activity Resume**: A Classic Transaction Flow started from a Yield Action in
activity history.
