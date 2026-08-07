# 02 — Remove unsupported multi-instance wallet concurrency

**What to build:** Simplify wallet runtime code around the supported single Widget Instance contract. Remove synchronization and isolation behavior that exists only for simultaneous widgets while preserving every concurrency mechanism needed for concurrent work inside one widget and for clean sequential remounts.

**Blocked by:** 01 — Enforce one Widget Instance lifecycle.

**Status:** ready-for-agent

- [ ] Audit wallet synchronization and isolation mechanisms by production purpose before removing them.
- [ ] Remove redundant reconnect-initialization serialization and its multiple-initializer contract when Wallet Bootstrap can invoke initialization only once per runtime generation.
- [ ] Remove or rewrite tests that claim simultaneous widget registries or runtimes are a supported production behavior.
- [ ] Retain connector-membership serialization, serialized event and command handling, queues, references, streams, resource deduplication, scoped fibers, and interruption required within one Widget Instance.
- [ ] Retain fresh runtime scopes and disposal behavior required for sequential unmount and remount.
- [ ] Wallet Bootstrap, reconnect, connector discovery, commands, and cleanup retain their existing supported behavior for one widget.
- [ ] Focused wallet tests distinguish removed multi-instance assumptions from retained intra-instance races and lifecycle guarantees.
