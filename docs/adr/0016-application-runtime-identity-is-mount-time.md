---
status: accepted
---

# Application Runtime Identity is mount-time

A Widget Instance owns one Application Runtime Generation and one stable Atom
Registry from mount through unmount. Its Runtime Identity consists of normalized
`apiKey`, `baseUrl`, `borrowApiUrl`, and `yieldsApiUrl` values plus
`borrowEnabled`.

Changing Runtime Identity while the Widget remains mounted is an invariant
violation. The Widget throws `ApplicationRuntimeIdentityChangedError` and
requires the host to unmount and remount before applying the new identity. Live
settings outside Runtime Identity continue through the existing configuration
boundary without replacing the registry.

This makes the lifetime of application services, the router, workflows,
resources, and one-shot machine state identical to the Widget Instance
lifetime. A host-requested Runtime Identity change cannot silently split
mount-time services from Atom configuration or reactivate initialization inputs.

## Considered options

- Key the Atom Registry by Runtime Identity and replace the Application Runtime
  Generation in place. Rejected because Widget Instance inputs and one-shot
  state would then require a second owner above the registry.
- Update mount-time service configuration in place. Rejected because scoped
  services capture their initial configuration and would disagree with live
  atoms during replacement.
