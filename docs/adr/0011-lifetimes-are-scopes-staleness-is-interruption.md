# Lifetimes are Scopes; staleness is interruption

A unit of relevance — a Flow Session, its execution reservation, a modal
opening, a connect attempt — is an Effect `Scope` (or a `FiberHandle` slot when
the latest attempt wins). Work that belongs to it runs as a fiber in that
Scope. Ending the unit closes the Scope, which interrupts its in-flight work at
the next asynchronous boundary and refuses later work by interruption. Code does
not keep revision, epoch, or generation counters and does not re-check
`isCurrent` between steps to decide whether to continue.

This trades typed `RejectedStale` outcomes for interruption: callers of an
ended handle observe an interrupted exit rather than a domain value, and Atom
results become an interrupt `Failure` that routes treat as unavailable.

Nested lifetimes are child Scopes. A resource that one owner bounds and another
consumer holds is acquired with `acquireInChildScope`, so it ends with
whichever closes first. Handles route their operations through
`makeScopedSerialOperations` created in their own Scope.

Interruption cannot cancel work that has already left Effect. Side effects that
must not be torn — router navigation, reservation plus navigation — run
uninterruptibly, so closing the Scope waits for them instead of abandoning them
mid-flight. Pass an `AbortSignal` where an external API accepts one.

Checks against external mutable state remain data validation, not lifetime:
for example, comparing a wallet's current identity before acting on it, or
guarding a third-party client's own pending-request slot.

Value identity that distinguishes otherwise-equal instances, such as a Session
`epoch` used as a React key or Atom family key, is allowed; it must never decide
whether work continues.
