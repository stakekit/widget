# Authoritative Resources own shared remote reads

Each canonical cacheable remote fact has one named Resource that owns request
identity, caching, freshness, retry, pagination, invalidation, and stale-result
suppression. Features project Resource state instead of creating parallel caches,
preventing divergent truth and transport coupling.
