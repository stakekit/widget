# Earn feature architecture

Earn owns the synchronous intent and deterministic resolution of Earn
Selection and Earn Readiness. It does not introduce a long-lived Effect service
for selection because user intent, resource observation, and projection require
no independent asynchronous orchestration, rollback, or scoped workflow.

The deterministic modules under `state/earn-selection/model/` receive only
plain entry, intent, previous-view, and authoritative resource `AsyncResult`
values. They
do not import Effect Atom, accept an Atom context, or know concrete resource
keys and retry targets.

The Atom adapter owns staged Authoritative Resource observation. It selects
complete resource identities in dependency order and keeps exact retry and
pagination targets private. `AsyncResult` remains the single representation of
loading, usable, refreshing, and failed resource state, including retained
previous success. Independent initialization and positions reads may start
together; later resource identities may depend on an earlier deterministic
selection result.

The root `state.ts` facade publishes stable view and command Atoms. Local user
intent stays authoritative in Atom, deterministic transitions stay plain
TypeScript, and React only renders the published view and dispatches intent.
Authoritative Resources retain caching, pagination, refresh, retry, and
stale-result policy.
