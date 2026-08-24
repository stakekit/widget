# Owned Modules expose finite interfaces

An Owned Module is private by default and exposes only explicit, finite
interfaces required by real consumers. This adds interface-maintenance cost but
keeps dependency direction enforceable and lets implementations change without
creating accidental cross-Module contracts.
