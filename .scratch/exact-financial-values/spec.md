# Preserve exact financial values through execution

Status: ready-for-agent

## Problem Statement

The Widget sometimes decodes token amounts, balances, limits, prices, ratios, and Base Unit Amounts into JavaScript `number` values. Decimal or large integer values can lose precision before they reach domain rules, Max actions, Review, Action Commands, or wallet transaction construction. A user can therefore review or submit a different amount from the value returned by an API or selected earlier in the journey.

The risk is not limited to one feature. Several application paths convert exact API strings into numbers and later reconstruct exact types from the already-rounded value. Formatting and domain calculation boundaries are also inconsistent, which makes it easy to reintroduce the same defect.

## Solution

Preserve financial values in exact canonical representations from boundary decoding through execution. Financial decimals use `BigNumber`; integer Base Unit Amounts use `bigint`. Counts, indexes, and chain IDs remain safe integer `number` values, while display-only percentages and chart points may use `number` when they cannot become action inputs.

Keep generated clients on Effect's native JSON decoding. The API contracts already encode execution-relevant token amounts, balances, limits, and Base Unit Amounts as strings; JSON numbers are confined to safe integers and non-execution values such as reward rates and legacy display prices. Exact finance schemas accept the documented string and number forms, and application models carry exact types. Action Command construction truncates nonnegative token amounts to the token's declared decimals and validates the result before execution. Presentation uses semantic formatters and never feeds a rounded display value back into application logic.

This specification implements ADR-0024, "Financial values remain exact through execution."

## User Stories

1. As a widget user, I want the amount returned by an API to remain unchanged when I later submit it, so that the Widget cannot send a rounded transaction.
2. As a widget user, I want a Max action to use my exact available balance, so that rounding cannot leave dust behind or request more than I own.
3. As a widget user, I want Pending Action minimum and maximum limits evaluated exactly, so that eligibility does not change because of JavaScript rounding.
4. As a widget user, I want Borrow balances and limits evaluated exactly, so that Borrow actions use the provider values I received.
5. As a widget user, I want Withdraw Max to preserve the exact supplied balance through Review and Action Command creation.
6. As a widget user, I want wallet transaction Base Unit Amounts larger than JavaScript's safe integer range preserved exactly.
7. As a widget user, I want Review to show the amount that will actually be submitted.
8. As a widget user, I want Complete to show the submitted or executed amount rather than an earlier, more precise input.
9. As a widget user, I want supported API string and number forms to decode into the same canonical decimal representation.
10. As a widget user, I want a malformed API response to fail as a response decoding error instead of silently changing an amount.
11. As a widget user, I want transient retries, geoblocking, and rich error reporting to keep using the generated client's normal response decoding.
12. As a widget user, I want financial calculations to preserve precision across chained operations.
13. As a widget user, I want division results to remain compatible with the Widget's existing calculation behavior.
14. As a widget user, I want an amount with excess token precision handled predictably at execution.
15. As a widget user, I want a positive amount that truncates below one Base Unit Amount rejected instead of submitting zero.
16. As a widget user, I want token quantities and fiat values formatted for my locale without changing their canonical values.
17. As a widget user, I want display rounding isolated from transaction and eligibility decisions.
18. As a widget user, I want display-only charts and percentages to remain responsive without imposing arbitrary-precision objects on presentation data.
19. As a host developer, I want existing public numeric serialization to remain locale-independent and compatible.
20. As a host developer, I want generated API clients to remain generated artifacts without application-specific patches.
21. As an API provider, I want the Widget to accept each financial field in the wire form declared by its API contract.
22. As an API provider, I want decimal and Base Unit Amount fields decoded independently without the Widget inventing precedence or consistency rules.
23. As a maintainer, I want one finance-owned set of exact schemas, constructors, conversions, and BigNumber configuration.
24. As a maintainer, I want Exact Token Amount and Base Unit Amount to remain distinct domain concepts.
25. As a maintainer, I want conversion to `number` confined to explicit display and chart adapters.
26. As a maintainer, I want generated success, typed-error, and unexpected-status responses to use Effect's normal JSON decoding.
27. As a maintainer, I want tests at API transport, Action Command, and wallet execution seams so implementation refactors cannot weaken the guarantee.
28. As a maintainer, I want repository checks to reject new financial finite-number schemas and accidental conversions back to JavaScript numbers.
29. As a maintainer, I want the migration to keep the build green while each user journey adopts the exact representation.
30. As a maintainer, I want JSON parsing behavior inherited from the standard Effect HTTP and Schema decoders rather than reimplemented locally.

## Implementation Decisions

- Token amounts, balances, limits, prices, fees, and domain financial ratios use `BigNumber` in Canonical App Models and domain logic.
- Base Unit Amounts use `bigint`. Counts, indexes, non-financial enumerations, and chain IDs use safe integer `number` values.
- Display-only percentages and chart points may use `number`. A display value cannot be reused as Entry Intent, an eligibility input, an Action Command value, persistence input, or transaction input.
- Finance owns exact numeric schemas, constructors, conversions, and BigNumber configuration. It publishes a small set of generally useful exact schemas plus semantic refinements instead of nominally branding every financial concept.
- BigNumber division explicitly uses 20 decimal places and `ROUND_HALF_UP`, preserving existing calculation behavior. Representation-specific rounding does not alter this domain rule.
- Exact finance boundary schemas accept the documented `string | number` forms. Both forms decode into the same canonical `BigNumber`; locale-independent encoding produces a string.
- Exact Base Unit Amount boundary schemas accept decimal strings and safe integers and decode into `bigint`; locale-independent encoding produces a string where serialization requires JSON compatibility. Chain-specific encodings such as EVM hex quantities belong to their wallet adapter.
- Generated API clients use Effect's native response JSON decoding. The Widget does not wrap `HttpClientResponse` or replace its JSON parser.
- The API contracts encode execution-relevant token amounts, balances, limits, and Base Unit Amounts as strings. JSON numbers remain limited to safe integers and values that cannot become transaction inputs, including reward rates and legacy display prices.
- Wallet transaction JSON uses `Schema.fromJsonString`. Decimal Base Unit Amounts larger than JavaScript's safe integer range must be quoted, and EVM hex quantities remain strings.
- JSON parser failures remain Effect HTTP client or Schema decode failures. Schema failures remain response schema failures; parser and schema failures do not collapse into one error.
- When an API provides related decimal and Base Unit Amount fields, schemas decode both independently and assume both are authoritative. The Widget does not compare them, infer which is correct, or reject disagreement.
- Canonical App Models, Entry Intent, Action Commands, and Flow Session intake carry `BigNumber` or `bigint`. Wire DTOs, persistence, and public serialization may carry locale-independent strings.
- Decoding preserves all supplied decimal precision. It does not reject or truncate a token value merely because it has more fractional digits than the token declares.
- The constructor for an executable Action Command truncates a nonnegative token quantity to the token's decimals. Normal command validation then rejects zero and checks minimum, maximum, balance, and other semantic limits against that executable value.
- A positive amount smaller than one Base Unit Amount truncates to zero and cannot produce an Action Command.
- Wallet adapters convert an Exact Token Amount to a Base Unit Amount only where a protocol transaction requires it. Already encoded Base Unit Amounts never pass through JavaScript `number`.
- Review and Complete use the exact executable amount captured by the Action Command or execution result. They do not reconstruct it from a rounded presentation string.
- Shared presentation code provides semantic formatters for token quantities, limits, fiat values, percentages, and compact metrics. Each formatter applies an explicit locale and display policy while keeping serialization locale-independent.
- Existing general number formatting remains the representation mechanism where suitable, but BigNumber configuration moves out of representation and into finance ownership.
- Conversion through `.toNumber()` is allowed only at a terminal representation or chart adapter. Domain, Resource, Service, Feature model, Action Command, and transaction code cannot use it for financial values.
- The migration follows expand-contract. First add the exact finance forms beside existing callers. Then migrate user journeys in independently verifiable batches. Remove obsolete finite-number financial paths and enable repository guardrails only after all batches are green.
- Repository guardrails target low-false-positive patterns: direct BigNumber construction outside finance-owned constructors, finite-number schemas in known financial models, and `.toNumber()` outside explicit representation and chart adapters. Type-only use of the canonical exact value remains permitted.
- Counts, indexes, chain IDs, and presentation-only numbers are not migrated merely because they appear near financial data.

## Testing Decisions

- Tests assert externally visible values and failures at the highest stable seam. They do not assert the concrete response-wrapper class, parser call count, private helper names, or generated-client implementation.
- The primary API seam uses unchanged generated clients and Effect's native response JSON decoding. Integration tests prove retries, geoblocking, rich-error observation, typed errors, and unexpected statuses still work without a response wrapper.
- API schema tests cover exact string amounts and the numeric reward-rate and legacy-price fields allowed by the contracts.
- Finance schema tests prove that string and number inputs decode to equal `BigNumber` or `bigint` values, invalid finite values fail, and encoding remains a locale-independent string.
- Pending Action tests start from decoded argument bounds and continue through amount eligibility, Max policy, Action Command creation, Review, and Complete. The exact decimal must survive every seam except the documented token-decimal truncation boundary.
- Borrow tests use the existing Borrow account snapshot, Market Position, action-preparation, and transaction-flow seams. They prove exact balances, limits, prices, risk calculations, Withdraw Max, command construction, and Review values.
- Wallet driver tests decode transaction JSON with a quoted Base Unit Amount of `"1000000000000000001"`, prepare the request, and assert the same integer reaches the wallet-facing transaction representation.
- Action Command tests cover truncation at token decimals, unchanged values already within precision, truncation to zero, minimum and maximum checks after truncation, and exact serialization.
- Representation tests provide `BigNumber` values that cannot pass safely through JavaScript number and assert locale-aware token and fiat output without feeding formatted text back into command construction.
- Chart and display-only percentage tests continue to use numbers and prove that their values are not part of transaction input.
- Architecture tests and AST fixtures prove that forbidden financial finite-number schemas, direct exact-value construction outside finance ownership, and non-presentation `.toNumber()` calls fail repository checks while explicit presentation adapters pass.
- Existing API response-schema tests are prior art for strict and tolerant domain decoding. Existing API client DOM tests are prior art for shared headers, retries, rich-error publication, and transport construction. Existing Borrow position and action-preparation tests are prior art for Withdraw Max and Action Command alignment. Existing EVM wallet-driver tests are prior art for prepared transaction values and typed decoding failures.
- Each migration ticket runs its focused unit or DOM tests plus Widget lint. Tickets that change ownership or imports also run root hygiene. The final contraction runs the full repository check.

## Out of Scope

- Rejecting all API JSON numbers or requiring display-only rates and legacy prices to migrate to strings.
- Choosing authority between related decimal and Base Unit Amount fields or validating that they agree.
- Replacing BigNumber with another decimal arithmetic library.
- Representing counts, indexes, chain IDs, display-only percentages, or chart points as BigNumber.
- Changing the Widget's public serialization format from locale-independent strings.
- Changing protocol rounding beyond truncating executable nonnegative token amounts to token decimals.
- Changing the current 20-decimal, `ROUND_HALF_UP` division behavior.
- Redesigning Review, Complete, charts, or financial copy.
- Patching generated API clients or the OpenAPI generator.
- Adding nominal brands for every financial field.
- Adding cross-field API correctness checks unrelated to decoding.

## Further Notes

- The confirmed risky paths are Pending Action amount bounds, Borrow financial response fields and Withdraw Max, and EVM unsigned transaction Base Unit Amounts.
- The current finance module already provides a string-to-BigNumber schema, and current token balance models already use it. The migration expands that ownership rather than creating a competing numeric module.
- Current number formatting performs BigNumber configuration as a representation side effect. Moving configuration into finance prevents import order from deciding calculation behavior.
- Effect 4.0.0-rc.109 parses HTTP response JSON with native `JSON.parse`. This is sufficient because the API contracts quote execution-relevant values that cannot safely pass through a JavaScript number.
- The accepted domain terms are Exact Token Amount, Base Unit Amount, Action Command, Entry Intent, Flow Session, Borrow Account Snapshot, Market Position, and Risk Position.
