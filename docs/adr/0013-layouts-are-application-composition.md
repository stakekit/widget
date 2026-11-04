# Layouts are application composition; Features are Layout-agnostic

The Widget presents one of two Layouts, the Compact Layout or the Dashboard
Layout, chosen by Host Configuration. Each Layout is application composition
under `app/layouts/<layout>/`: its shell, route tree, tabs, and page
transitions. Features own their screens and state for both Layouts and never
read which Layout is active, so a Feature's behavior cannot silently diverge
between Layouts and a Layout can change without touching Feature logic.

Inside a Feature, `ui/` holds components both Layouts render, while
`ui/compact/` and `ui/dashboard/` hold Layout-specific screens and never import
each other. `model/`, `state/`, and `react/` are Layout-free and are named after
what they model: they never read or branch on the active Layout, though they may
name the Layouts a navigation target requires. A Layout difference is expressed
as a Layout-specific component, a prop supplied by the Layout's composition
that names the difference rather than the Layout, or a Presentation Setting; it
is never a runtime branch on the Layout inside a Feature.

Presentation Settings carry visual differences such as call-to-action size,
gutter and tabs indicator. Application composition resolves them from the
Layout's defaults and the Host Profile's overrides and passes them to the
Design System's theme root, which applies them to the Widget root and its
portal container (ADR 0015). They are named after the difference, never after
the Layout, and no style is keyed by the Layout.

A route declares the Layouts that mount it, and a test checks each Layout's
route tree against those declarations. Navigation that starts outside React
states which Layouts its target exists in.

## Considered options

A top-level `layouts/` owner holding every screen for its Layout was rejected:
it separates a capability's screens from the Feature that owns its state and
interface, and both Layouts share nearly all of that state. Reading the Layout
from Widget Configuration inside components was the previous approach and was
rejected because the coupling is invisible to the import graph and to review.

## Consequences

The public `layout: "compact" | "dashboard"` option is the host-facing switch;
Widget Configuration normalizes it to the Layout. The deprecated
`dashboardVariant` option is still accepted and mapped to `layout`, and `layout`
wins when a host passes both. dependency-cruiser forbids imports between
`ui/compact/` and `ui/dashboard/` and from Layout-free folders into either, and
ast-grep rejects Layout reads outside application composition and Widget
Configuration.
