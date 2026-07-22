# 09 — Isolate the Transaction Workflow handoff

**What to build:** Make Transaction Workflow consume one pure handoff projected from an Executable Classic Transaction Flow, with execution-machine lifetime separated by Classic Flow identity while preserving Yield Action identity and all existing execution semantics.

**Blocked by:** 06 — Migrate the Enter journey; 07 — Migrate the Exit and Manage journeys; 08 — Migrate Activity Resume and unified flow lifetime.

**Status:** ready-for-agent

- [ ] Transaction Workflow handoff is projected from the active Executable flow and is not stored as a second authority.
- [ ] Classic Transaction Flow Identity participates in the local execution-machine generation key so distinct flows cannot share machine state through structural equality.
- [ ] Yield Action ID remains the workflow diagnostic, error, history, and API identity.
- [ ] Activity Resume Back and Continue reuse the same machine generation because the Classic Flow identity is retained.
- [ ] Enter, Exit, or Manage Back creates a new machine generation after the new flow prepares its fresh Yield Action.
- [ ] Submission, signing, confirmation, pending, retry, failure, and completion remain Transaction Workflow state and do not become Classic Flow phases.
- [ ] The Classic flow remains Executable through steps and completion and is abandoned only at its established lifecycle boundary.
- [ ] Execution state and commands remain Effect/Atom-owned; React consumes view Atoms and synchronously dispatches intents without workflow orchestration.
- [ ] Integration tests cover generation separation, Activity Resume reuse, preserved Yield Action diagnostics, completion/history effects, and unchanged execution behavior.
- [ ] This migration remains on the shared integration branch until ticket 10 completes the atomic cutover.
