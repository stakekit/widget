# Lifetimes are Scopes; staleness is interruption

A unit of relevance — a page within a Flow Session, a modal
opening, a connect attempt — is an Effect `Scope` (or a `FiberHandle` slot when
the latest attempt wins). Work that belongs to it runs as a fiber in that
Scope. Ending the unit closes the Scope, which interrupts its in-flight work at
the next asynchronous boundary and refuses later work by interruption. Code does
not keep revision, epoch, or generation counters and does not re-check
`isCurrent` between steps to decide whether to continue.

This trades typed staleness outcomes for interruption: callers of an ended
handle observe an interrupted exit rather than a domain value, and Atom results
become an interrupt `Failure` that routes treat as unavailable.

Nested lifetimes are child Scopes; when React subtrees own them, mounting nests
them, so an inner lifetime ends before the one that holds it. A long-lived
handle whose commands start work that must not outlive it routes those commands
through `makeScopedSerialOperations` created in its own Scope.

The owner of a lifetime is whoever consumes it. When that consumer is a React
subtree, the subtree owns the Scope: the Atoms it subscribes to open the unit,
and their Scopes end it when it stops subscribing. The Feature exposes the
opening operation and the data handoff (for a Flow Session, Review navigation
state; for a Yield Action Continuation, the Activity route that mounts it), not
a global "current" slot that a route must look up and reconcile. A second owner for the same
lifetime is what reintroduces identity counters and admission checks. Layouts
that remount routes on navigation derive their key from the path (a flow's
Review, Steps, and Complete share one), never from a live Session.

A Transaction Flow's pages are such lifetimes. The flow route holds the
Session: the flow's input and the handoff between its pages. A page's effect
Atoms — Review's preview request, Execution's workflow — run while the page
shows them. Steps and Complete show one Execution, so moving between them keeps
its workflow, and leaving both ends it without a command. Review hands its
confirmed action to the Execution that follows through the Session, which
holds it until that Execution ends, so Review cannot hand off a second one
meanwhile. An Execution revisited through history after it ended finds nothing
to execute and leaves the flow instead of starting a second workflow. Arriving
at Review releases an action still waiting for a Steps that never started it,
so that handoff neither blocks the next confirmation nor starts later; an
action already running stays held until its Execution ends.

React may render a route more than once before committing it, and a render can
read an effect Atom, so Atoms are never created per render or per mount. A page
model comes from an `Atom.family` keyed by data that every render of the page
shares: Review's by its Session and history entry, Execution's by its Session
and the handoff Steps' navigation state names: Borrow's created action's id,
or Classic's handoff itself, since a confidential vault's action exists only
once its workflow prepares it. A discarded render then reads the same Atom as the
committed one, and one workflow runs.

Interruption cannot cancel work that has already left Effect. Side effects that
must not be torn — router navigation, a handoff plus its navigation — run
uninterruptibly, so closing the Scope waits for them instead of abandoning them
mid-flight. Pass an `AbortSignal` where an external API accepts one.

Checks against external mutable state remain data validation, not lifetime:
for example, comparing a wallet's current identity before acting on it, or
guarding a third-party client's own pending-request slot. Such a check may
return a typed rejection: adding a Ledger account rejects when the Wallet
Command Identity captured at the start no longer matches.

Value identity that distinguishes otherwise-equal instances, such as a Session
`epoch` used as a React key or Atom family key, is allowed; it must never decide
whether work continues. Attempt identity may select which UI instance a
completed, uninterruptible result applies to: the pending-action modal closes on
a flow-start receipt only when the receipt's attempt identity matches the open
modal's.
