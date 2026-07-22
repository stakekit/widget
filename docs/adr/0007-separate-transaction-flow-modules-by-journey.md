---
status: accepted
---

# Separate Transaction Flow modules by journey

Classic Transaction Flow and Borrow Transaction Flow are separate feature modules that own their distinct Flow Session intake, preparation, projections, navigation, and abandonment behavior while adapting the shared Transaction Workflow module for execution. The Borrow market, form, position, and resource module starts Borrow Transaction Flow through immutable intake and observes read-only flow outcomes to reset its own state, so the flow never imports back into Borrow; the current routed Flow Session remains authoritative without a generic flow implementation or application-global Flow Session coordinator.
