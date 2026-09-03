# Effect Schema owns value-shaped boundary decoding

External values can satisfy partial TypeScript shapes without meeting the
contracts that application state relies on. The Module that owns a trust
boundary decodes value-shaped inputs with Effect Schema before their fields
affect application state or behavior; opaque capabilities cross through
explicit typed adapters, and property probes, casts, or handwritten type
predicates do not promote untrusted values into domain types. This centralizes
normalization and typed failures while allowing the boundary contract to reject,
recover from, or discard invalid input.
