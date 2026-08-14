---
status: accepted
---

# Widget Configuration is dynamic outside fixed runtime identities

A Widget Instance accepts Host Configuration changes throughout one Application
Runtime Generation. `WidgetConfigService` trusts the typed public boundary and
is the exclusive owner of applying defaults and normalization. One normalization
function produces the complete Widget Configuration used throughout the app;
other modules may select snapshots or identities from that value but do not
normalize it again. The function is private to the service, pure, and receives
one immutable environment value containing deployment defaults and runtime
facts. Widget Configuration resolves every application-wide default and
canonicalizes collections as arrays; genuinely absent host capabilities remain
optional. Updates are serialized in host-render order and atomically replace
the current value only when its normalized value differs. React consumers
subscribe through read-only Atom projections, Effect operations capture the
current value when they begin, and deliberately live processes observe a
non-failing stream that starts with the current value and continues with each
distinct replacement.

The private normalizer returns either Widget Configuration or an
`InvalidWidgetConfiguration` containing safe semantic issue codes. It does not
Schema-decode Host Configuration. Initial semantic failure prevents service
construction; a later failure is logged and ignored while the last valid value
remains current. API endpoints are fully resolved there, including existing
endpoint cleanup. External-provider supported chains are canonicalized by
deduplicating and sorting while preserving the distinction between absent and
explicitly empty input. Configuration-specific normalization is written in this
single function rather than delegated to smaller config-aware helpers. Neutral
collection utilities may be reused.

The normalized API key and endpoints form Application API Identity, a projection
of Widget Configuration rather than a fixed generation constraint. Changing them
publishes a new Widget Configuration like any other valid update.
`borrowEnabled` is likewise dynamic. Wallet Bootstrap separately captures an
immutable Wallet Bootstrap Snapshot; the Wallet Runtime continues to enforce
changes that would invalidate its constructed Wallet Topology. This supersedes
ADR 0016's broader Application Runtime Identity.

React composition passes Host Configuration only to the service binding
adapter. Until a valid replacement is published, every consumer continues to
observe the previous Widget Configuration. Dynamic changes such as disabling
Borrow or replacing the Classic/Dashboard route tree remove their React route
scopes and run the scopes' finalizers while preserving the Application Runtime
Generation and router history. The root binding applies host rerenders in a
layout effect, so descendants may render the previous value once while an
update is published before paint.

The application runtime receives the initial Host Configuration through a
one-shot bootstrap adapter and constructs the service without a temporary
default Widget Configuration. Effect-native state inside the service is the
authority. Atoms outside `services` only adapt that state for application
runtime construction and React observation.

Production interfaces use one exact dependency representation. Tests adapt to
that contract rather than adding primitive-or-Effect unions, defaults, or other
test-only alternatives to production constructors. Repository enforcement
specifically protects the Borrow operation and resource constructors from
regaining boolean alternatives or default values.

Functions derived from Widget Configuration are projections only. In
particular, `selectWidgetBootstrapSnapshot` may select or restructure normalized
fields but may not apply defaults, trim values, sort, deduplicate, change
casing, or coerce values. It lives beside the service. Consumers may build Sets,
Maps, or lookup indexes from canonical collections when that does not change
semantic membership or ordering.

The pure normalizer performs no logging. The service logs safe issue codes,
crashes construction after an initial failure, and returns `RejectedInvalid`
for an invalid update.

Tests acquire Widget Configuration through a real `WidgetConfigService` layer.
They do not expose another helper named or presented as normalization.
