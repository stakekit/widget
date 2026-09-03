# Owned Modules expose finite interfaces

An Owned Module is private by default and exposes only explicit, finite
interfaces required by real consumers. This adds interface-maintenance cost but
keeps dependency direction enforceable and lets implementations change without
creating accidental cross-Module contracts.

The public-api layer may depend on a Domain Module only through that Module's
`contract.ts` interface. A Domain contract may expose selected stable types and
runtime values required by hosts, while Effect schemas, decoders, and other
implementation details remain private.

This dependency is one-way: Domain Modules do not depend on `public-api`.
Host-facing concepts that are also used by Domain move to the owning Domain
contract rather than creating a bidirectional layer boundary.

Domain catalogues remain private unless their complete shape is intentionally a
host contract. Public interfaces instead consume narrow projections from the
Domain contract.

Published declarations use the normal TypeScript declaration graph rather than
maintaining declaration-only mirrors. A library referenced by that graph is a
package runtime dependency even when consumers encounter it only while resolving
types. React and ReactDOM remain peer dependencies. Approved breaking changes
may remove implementation-shaped host APIs instead of preserving third-party
types under Widget-owned names.

Dependency-cruiser restricts direct imports from `public-api` to Domain
`contract.ts` files. The declaration build emits the source files reachable
from the public entries with `src` as its root.

Published declarations expose only dependencies that belong to the host
contract. The package entry may reference `effect` and `react`; the standalone
bundle may reference only `effect`. Packed consumers compile both entries under
Bundler and NodeNext resolution, and an executable declaration-graph check
enforces these dependency allowlists.
