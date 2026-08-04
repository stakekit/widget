---
status: accepted
---

# Unobserved Atoms are transient by default

The application Atom registry has no default idle TTL, so an ordinary Atom is
disposed as soon as it becomes unobserved. Feature state must not persist merely
because its Atom identity remains reachable: state that intentionally survives
navigation receives an explicit owner module or persistence mechanism, while
`keepAlive` is reserved for modules owned by the Application or Wallet Runtime
Generation. Production code does not configure registry `defaultIdleTTL` or
apply finite TTLs directly, and architecture checks enforce both restrictions.

Canonical remote reads are the sole finite-retention exception. The shared API
resource policy retains them for a fixed five minutes after their last observer
and revalidates stale data when they mount; callers provide only
resource-specific stale time. Derived projections, scans, commands, and
presentation adapters remain transient, including those located in resource
modules. This keeps cache policy behind one resource seam without turning every
Atom into an implicit five-minute state store.

This refines ADR-0008 and supersedes the explicit zero-idle-TTL implementation
detail in ADR-0017 and ADR-0018. Passing a registry default of zero was rejected:
Effect Atom's native immediate-disposal behavior is selected by omitting the
default, while an explicit zero enters its timer-based TTL path. Per-resource
idle overrides and feature-local `keepAlive` were rejected because they spread
lifecycle policy across callers and permit accidental state resurrection.
