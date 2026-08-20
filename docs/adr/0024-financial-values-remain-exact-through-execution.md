---
status: accepted
---

# Financial values remain exact through execution

The Widget preserves execution-relevant financial values from an untrusted boundary until transaction execution. Token amounts, balances, limits, fees, and protocol financial ratios decode into `BigNumber`; integer Base Unit Amounts decode into `bigint`. Counts, indexes, chain IDs, legacy display prices, and display-only rates may use `number` because they never become action inputs.

The API contracts encode execution-relevant token amounts, balances, limits, and Base Unit Amounts as JSON strings. Native JSON parsing therefore preserves their source precision before domain schemas decode them. JSON numbers remain for safe integers and non-execution values such as reward rates and legacy display prices. Finance schemas accept `string | number` where both forms exist and decode them into the canonical representation. Generated clients use Effect's normal response JSON decoding without an HTTP response wrapper. Wallet adapters decode nested transaction JSON with `Schema.fromJsonString`; EVM quantities remain exact because the contract quotes decimal quantities or encodes them as hex strings.

`domain/finance` owns exact numeric schemas, constructors, conversions, and the application-wide `BigNumber` configuration. Division explicitly retains 20 decimal places with `ROUND_HALF_UP`, preserving the previous calculation behavior. Canonical App Models, Entry Intent, Action Commands, and Flow Session intake carry `BigNumber` or `bigint`, while persistence and public serialization use locale-independent strings. When an API supplies related decimal and Base Unit Amount fields, the Widget decodes each field independently and assumes both are authoritative; it does not infer precedence or add cross-field consistency checks. The shared Base Unit Amount schema accepts decimal strings and safe integers; chain-specific encodings such as EVM hex quantities decode in the wallet adapter that owns them.

Decoding never reduces token precision. The boundary that constructs an executable Action Command truncates a nonnegative token amount to the token's declared decimals, then validates the resulting Exact Token Amount against zero and its semantic limits. A positive input smaller than one Base Unit Amount therefore becomes zero and is rejected. Wallet transaction construction converts an Exact Token Amount to `bigint` only when the protocol requires a Base Unit Amount. Review and Complete represent the exact submitted or executed amount rather than an earlier, more precise input.

Representation formatting remains presentation-owned. Shared semantic formatters accept exact values, apply an explicit locale and display policy, and may convert to `number` only at a terminal display or chart adapter. Formatting never supplies a value to domain logic, an Action Command, persistence, public serialization, or a transaction.

## Consequences

- Pending Action bounds, Borrow Max actions, EVM transaction values, and other confirmed risky journeys migrate after the finance foundations land; the remaining application financial fields follow through an app-wide audit.
- Boundary tests cover API string amounts, supported numeric display values, and quoted EVM Base Unit Amounts beyond JavaScript's safe integer range.
- Journey tests prove that Pending Action and Borrow Max values reach Action Commands unchanged except for token-decimal truncation, including truncation to zero, and that Base Unit Amounts beyond JavaScript's safe integer range remain exact.
- Repository guardrails prevent direct `bignumber.js` construction outside `domain/finance`, finite-number schemas in known financial models, and `.toNumber()` calls outside explicit representation and chart adapters.

## Rejected alternatives

- JavaScript `number` for financial domain values, because a later Action Command or transaction can receive a rounded value.
- Strings throughout the application, because they move parsing and arithmetic rules into every consumer instead of establishing one canonical domain representation.
- `BigNumber` for Base Unit Amounts, because those values are integers and `bigint` expresses that invariant directly.
- Rejecting numeric API JSON, because existing APIs may validly use either strings or numbers.
- Intercepting generated clients' `HttpClientResponse`, because the API contracts already quote every execution-relevant value that cannot safely pass through a JavaScript number.
- Rejecting token inputs with excess fractional precision, because truncation at executable Action Command construction gives one predictable protocol boundary while preserving precision everywhere earlier.
