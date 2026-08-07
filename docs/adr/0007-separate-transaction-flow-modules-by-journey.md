---
status: accepted
---

# Separate Transaction Flow modules by journey

Classic Transaction Flow and Borrow Transaction Flow are separate feature modules that own their distinct Flow Session intake, preparation, projections, navigation, and abandonment behavior while adapting the shared Transaction Workflow module for execution. Borrow market, form, position, and resource modules start Borrow Transaction Flow through immutable intake, so the flow never imports back into Borrow; the current routed Flow Session remains authoritative without a generic flow implementation or application-global Flow Session coordinator. ADR-0018 supersedes the Borrow-specific outcome collaboration: feature-owned Widget Domain Event projections now consume owner-scoped Entry Intent.
