---
status: accepted
---

# Effect DateTime owns application time

Widget application and test code represents instants with Effect `DateTime`, intervals with `Duration`, and effectful current time with `Clock` or `DateTime.now`. Native JavaScript `Date`, `date-fns`, and Effect APIs that convert application values to native `Date` are not part of the application model. Generated code and third-party library internals remain outside this decision.

API date-time strings are decoded at the boundary into UTC `DateTime` values. Required invalid timestamps reject their containing object. Invalid optional timestamps become `undefined`, and invalid nullable timestamps become `null`; both tolerant cases emit a structured warning containing the operation and field but not the rejected value. Strings are produced again only at serialization boundaries.

Presentation explicitly supplies locale and converts UTC instants to the browser's local time zone. Relative labels share one observed, scoped minute ticker. Human durations use floored display buckets: less than one minute, minutes below one hour, hours below one day, days below 31 days, approximate months below 365 days, and approximate years thereafter. Domain thresholds use named durations such as `Duration.days(7)` and remain independent of presentation wording.

The synchronous Cosmos WalletConnect adapter may use `DateTime.nowUnsafe()` because its inherited library callback cannot yield an Effect. No other handwritten widget or test code may use unsafe wall-clock access. An AST rule enforced by the normal lint command prevents native `Date`, native-Date interop schemas/conversions, and unsafe DateTime clock helpers outside that adapter.

## Consequences

- Domain models, history points, workflow gates, connector expiries, tests, and UI helpers share one time representation.
- Time-dependent application behavior is controllable by Effect runtimes, while pure comparisons accept an explicit `now`.
- A seven-day Activity resume gate is owned by the Classic Transaction Flow and blocks confirmation at the command boundary; React only renders the published state.
- Date formatting has no global locale mutation. Translation owns duration wording and callers supply the active locale for absolute formatting.
- Library code may internally use native `Date`; application lint does not inspect dependencies or generated sources.

## Rejected alternatives

- Keeping `date-fns` for display helpers, because it preserves a second time model and native `Date` conversions.
- Treating all malformed timestamps as fatal, because optional metadata must not discard an otherwise valid API object.
- Computing current time in React, because domain gates and refresh lifetimes belong below the view layer.
- Encoding elapsed domain thresholds as display units, because labels such as days and months are presentation buckets rather than exact business intervals.
