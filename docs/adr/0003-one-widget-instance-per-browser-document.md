---
status: accepted
---

# One Widget Instance per browser document

StakeKit Widget supports at most one concurrently mounted Widget Instance per browser document. Concurrent mounts are rejected because document-wide wallet discovery, translation state, and host integration resources make reliable isolation costly and fragile; a host must unmount the active Widget Instance before mounting another.

The public embedding root owns a document-level claim with a stable identity shared across separately bundled widget copies. A second mount fails fast without disturbing the active Widget Instance, and the bundled renderer exposes unmounting so the claim can be released for a sequential mount.

This supersedes ADR-0002's statement that independent widget instances are supported. Concurrency machinery and tests whose sole purpose is concurrent Widget Instance isolation are removed, while scoped lifetimes, sequential-remount behavior, and concurrency control required inside the single supported Widget Instance remain.
