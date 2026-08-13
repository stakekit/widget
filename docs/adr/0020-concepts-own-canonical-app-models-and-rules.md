---
status: accepted
---

# Concepts own Canonical App Models and rules

Canonical App Models and their pure rules are owned together by domain concept
modules. A concept composes generated wire schemas into branded, time-safe,
application-owned schemas at trust seams and publishes their inferred types for
the rest of the application. Generated wire models remain private inputs, and
API capabilities decode into canonical models before values reach Resources,
workflows, or features.

The technical-kind `domain/schema` and `domain/types` folders are replaced by
concepts such as Action, Earn, Finance, Network, Portfolio, Token, and Wallet.
Presentation models, reactive state, orchestration state, wallet-platform
adapters, and generic decoding mechanics are excluded from concept models.

Token is one canonical schema and type. Its identity is network, exact
case-sensitive symbol, and address. EVM addresses compare case-insensitively;
non-EVM addresses compare exactly; a missing address remains distinct from an
empty address.

This keeps generated transport vocabulary and `*Dto` names out of application
interfaces, makes schemas and rules discoverable through the concept they
describe, and prevents feature read models from becoming accidental sources of
truth. A repository-wide public/private module convention and a generic
internal-import checker are intentionally deferred.
