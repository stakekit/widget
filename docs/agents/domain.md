# Domain documentation

Read `CONTEXT.md` before naming or changing domain concepts. Read only the ADRs
in `docs/adr/` that constrain the area being changed.

`CONTEXT.md` is the vocabulary source of truth. Use its terms in code, tests,
issues, and proposals; update an existing definition when the owned concept
changes.

ADRs are a living set of current, durable decisions—not a timeline. Update a
decision in place when its rationale still matters, or remove it when it no
longer constrains the code. Git history preserves earlier states.

A new ADR is appropriate only for a hard-to-reverse, surprising decision with a
real tradeoff, and requires human approval. Other behavior belongs in code and
tests. Creating any other durable document or document category also requires
human approval.

If a proposed change conflicts with a current ADR, surface that conflict before
implementation rather than silently overriding it.
