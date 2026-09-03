# Local issue tracker

`.scratch/` contains active local specifications, maps, and implementation
issues. It is working state for an effort, not durable product documentation.
Completed-effort retention and removal are human-owned.

## Feature efforts

- Directory: `.scratch/<feature-slug>/`
- Specification: `.scratch/<feature-slug>/spec.md`
- Issues: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage: a `Status:` line near the top using `triage-labels.md`
- Discussion: append under `## Comments`

When a workflow says to publish to the issue tracker, create or update the
appropriate file in that effort directory. When it says to fetch a ticket, read
the referenced local file.

## Wayfinding efforts

- Map: `.scratch/<effort>/map.md`
- Child: `.scratch/<effort>/issues/<NN>-<slug>.md`
- Type: `research`, `prototype`, `grilling`, or `task`
- Status: `claimed` or `resolved`
- Dependencies: `Blocked by: NN, NN`

The frontier is the first numbered open, unblocked, unclaimed child. Claim it by
setting `Status: claimed` before work. Resolve it by appending `## Answer`,
setting `Status: resolved`, and adding a concise result and link to the map's
decisions-so-far.
