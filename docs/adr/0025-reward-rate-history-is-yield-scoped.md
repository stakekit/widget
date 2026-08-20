---
status: accepted
---

# Reward Rate History is yield-scoped

Reward Rate History is a time series of Yield Reward Rate snapshots. The Widget does not present it on a yield that requires validator selection, because Effective Reward Rate is then validator-scoped and no validator-scoped history exists.

A later validator-specific history API would be a new data product, not a Widget overlay of Yield Reward Rate History under a Validator Reward Rate title. An uninformative-looking flat series is still history when at least two snapshots exist; it is not a reason to hide the chart on yields that may present history.

## Rejected alternatives

- Fetch or synthesize per-validator history in the Widget from the current Validator Reward Rate.
- Keep showing Yield Reward Rate History on validator-required yields and relabel the title as an average.
- Hide any history series whose points are equal, including vaults with a real flat Yield Reward Rate.
