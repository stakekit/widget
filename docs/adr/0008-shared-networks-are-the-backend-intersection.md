# Shared Networks are the backend intersection

A Network used in shared Widget domain data must be declared by both the Legacy
and Yield backends. The domain Network module composes their generated schemas
as an intersection rather than trusting either backend alone or admitting their
union, so a one-sided rollout cannot enter shared domain state before both
required product-data sources support it. The isolated public declaration keeps
a compile-time-checked mirror of that type.

Wallet Bootstrap obtains the current project's enabled network IDs from the
Yield API and narrows them to Wallet Networks. It does not consult or fall back
to the Legacy enabled-networks endpoint.
