# Effect and Effect Atom own application logic outside React

Plain TypeScript owns deterministic rules, Effect owns side effects and the
multi-step operations that combine them, and Effect Atom owns reactive
composition and adapters, including per-page view models whose effect Atoms
scope a page's work to its mount. React renders published state and dispatches
commands, trading familiar hook orchestration for typed failures, scoped
cleanup, and testable seams.
