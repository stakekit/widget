# Core application high-risk fix plan

## Review contract

- Treat the current application and verified user flows as the behavioral source
  of truth. OpenSpec artifacts and existing tests are not specifications.
- Use `main` only as a behavioral comparison for regressions.
- Prove each fix at a user-observable seam before accepting it.
- Keep fix verification and the subsequent discovery review independent.

## Agreed test seams

| Finding | Observable seam | Acceptance criterion | Status |
| --- | --- | --- | --- |
| H1 | Host configuration rerender during transaction execution | Replacing only live callback identities preserves the registry, runtime, workflow identity, and exactly-once signing/submission behavior. | Fixed and verified |
| H2 | Leaving or cancelling the classic steps route | Unmounting the workflow route interrupts deferred signing/confirmation and cannot restart it through history navigation. | Fixed and verified |
| H3 | Wallet provider after best-effort initialization failure | Reconnect, mobile fallback, or initial-chain-switch failure preserves configured connectors and permits manual recovery. | Not fixed: atom seams pass; automatic reconnect browser integration fails |
| H4 | Position details across wallet changes | Data and staged actions captured for wallet A are unavailable immediately after switching to wallet B. | Fixed and verified |
| H5 | Resolved force-max Earn form | A force-max yield resolves to the available balance, never the `-1` sentinel, and stays disabled while that balance is unknown. | Fixed and verified |
| H6 | Screens after successful transaction completion | Earn, Activity, and Borrow invalidate and refetch the exact wallet-scoped resources consumed by their visible screens. | Fixed and verified |

## Execution waves

1. Independently verify the staged candidate across runtime/wallet,
   Earn/Activity, and position/Borrow seams.
2. Patch confirmed gaps one vertical red-green slice at a time.
3. Run focused unit, DOM, and browser tests plus package lint/type checks.
4. Assign fresh agents to complete flow-based review lanes, explicitly searching
   for regressions and previously unknown lifecycle/state bugs.

## Evidence log

- Lint, Biome, and TypeScript passed.
- Unit: 86 files / 323 tests passed.
- DOM: 20 files / 48 tests passed.
- Focused Chromium: classic workflow 8/8, Borrow execution 6/6, Borrow position
  flow 2/2, and dashboard rendering 8/8 passed.
- Full Chromium: 12 files / 55 tests passed; 9 tests failed across the known
  Wagmi reconnect regression and full-suite gas, staking, deep-link, and
  dashboard timeouts. Dashboard rendering passed in isolation.
- Hygiene checks passed.
- Detailed verdicts, additional findings, and report-only medium issues are in
  `REPORT.md`.
