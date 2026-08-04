---
status: accepted
---

# Scope Transaction Workflows by execution

Each time an action enters execution, its immutable Transaction Workflow Input creates a fresh Transaction Workflow scoped Atom. That scoped Atom alone owns the workflow lifetime; releasing it disposes the machine, resets its passive read capabilities, and revokes retained commands so none can extend or revive the execution. Structurally equal inputs never share a workflow. Classic and Borrow adapters compose their distinct projections and completion behavior around the shared module, permit brief isolated overlap while an older route scope exits, and suppress stale UI-ownership outputs such as routing and handoff cleanup without suppressing transaction-truth outputs such as tracking. ADR-0018 projects resource invalidation asynchronously from the workflow's once-only Ended fact. No application-global workflow claim or `Atom.family` identity is introduced.
