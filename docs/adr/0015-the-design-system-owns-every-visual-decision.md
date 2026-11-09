# The Design System owns every visual decision

The Widget's visual decisions belong to one Owned Module, the Design System
(`src/ui/`): tokens, themes, the scoped reset, primitives, components, patterns,
icons and artwork. Only the Design System uses StyleX, Base UI, `motion`,
Recharts, TanStack Virtual and SVG icon markup. Features and application
composition build UI only by composing the Design System's parts: they write no
HTML elements, `className`, `style` or raw values. A screen that looks wrong is
fixed by changing or extending the Design System, so every screen keeps one
look and every fix reaches every screen.

The Design System publishes two interfaces under ADR 0007: `index.ts` for
Features and application composition (primitives, components, patterns and
their finite prop types), and `composition.ts` for application composition only
(the theme root, which themes the Widget root and the portal container inside
it, theme resolution for a color scheme and Appearance Preset, and the
Presentation Settings it applies). It imports only its own
modules and libraries, nothing from Features, Resources, services, application
composition, Domain, `public-api`, `shared` or `generated`; it receives plain
values, and Features map their domain values onto its props. `shared` keeps
only neutral non-visual utilities.

## Styling: StyleX

The Widget styles with StyleX because `stylex.props` merges per property and the
last argument wins, whatever file declared the style. Overrides therefore follow
the order they are applied in, not the order stylesheets happen to be emitted
in.

The Widget is embedded in pages it does not control, so two configuration
constraints hold in every build and Vitest project:

- a class-name prefix unique to the Widget, so a host that also uses StyleX
  cannot collide with the Widget's class names;
- no CSS layers, because layered CSS loses to any unlayered host CSS, while
  unlayered StyleX raises higher-priority rules to ID-level specificity.

Hosts keep importing the one published stylesheet. The only global stylesheet
is the scoped reset (plus overrides for third-party markup the Widget renders):
every selector is scoped to the Widget root or its portal container, beats bare
host element selectors and loses to every StyleX rule. The Design System's
custom properties are not a host contract.

## Behavior: Base UI

Base UI provides every interactive behavior (dialogs, menus, selects, tabs,
popovers, tooltips and the other controls). It is bundled privately, not shared
with the host. Popups render into the Widget's portal container, which by
default lives inside the Widget root, so they stay inside a host dialog's DOM
and stacking context; a host-supplied `portalContainer` still wins. The portal
container carries the theme root's classes and variables. A journey test
mounts the Widget inside Radix and Base UI host dialogs and checks that focus,
Escape and clicks stay inside the Widget's popups.

## Appearance

Hosts theme the Widget through `appearance`: Color Roles for light and dark, a
color scheme of `light`, `dark` or `system`, and radius, control-height, font
and weight settings. Changes apply live, without remounting (ADR 0004). Invalid
values are dropped with a warning; the rest of the Host Configuration still
applies.

Precedence, lowest to highest: the base scheme, the Host Profile's Appearance
Preset, the mapped legacy `theme`, then `appearance`, which wins key by key. The
host has the final say over its Host Profile's preset.

`theme`, `lightTheme`, `darkTheme` and `dashboardVariant` are deprecated and
stay accepted until the next major version. At the Host Configuration boundary,
a legacy `theme` is decoded, its scheme is inferred from the frozen legacy light
and dark defaults, leaves equal to their default are dropped, and the remaining
leaves are mapped onto Color Roles and shape settings by a fixed table in which
the first customized key wins. An unchanged `lightTheme` or `darkTheme`
therefore yields the new default design in that scheme. Each legacy key with
no mapping is named once, in every build, in a warning that points to
`appearance`. `dashboardVariant` maps to `layout`, which wins when both are set
(ADR 0013).

## Considered options

- **Staying on vanilla-extract with stricter rules.** Rejected: which of two
  conflicting styles wins depends on the order stylesheets are emitted in, not
  the order they are applied, so overrides break unpredictably however strict
  the authoring rules are.
- **Keeping Radix.** Rejected in favor of Base UI, which covers every control
  the Widget needs (including tabs, toggle groups, switches, selects, drawers
  and meters) under one library, and bundles privately instead of relying on
  focus and scroll-lock internals shared with the host.
- **Keeping the token-shaped theme as the host contract.** Rejected: its
  implementation-shaped tokens tie hosts to internal component structure and
  applied only partly where screens hard-coded values.
- **Adopting the Design System screen by screen with advisory rules.**
  Rejected: the codebase moves over in one migration with the rules enforced,
  so no Feature keeps a second styling convention and the old engine, Radix and
  the token-shaped theme are removed at its end.

## Consequences

dependency-cruiser allows StyleX, Base UI, `motion`, Recharts, TanStack Virtual
and style definition modules only inside the Design System, restricts Features
and application composition to its main interface, and restricts its
composition interface to application composition. ast-grep rejects lowercase
JSX elements and `className` or `style` attributes in Features and application
composition, and color literals and raw sizes, weights, line heights, radii,
shadows, z-indices and durations inside the Design System outside its token
definitions and artwork. These rules apply to every file, with no exemption
list; every suppression states its reason. Design System parts omit
`className` and `style` from their types, and `as` is a finite union. Every
part and variant has a story that runs as a Chromium test with accessibility
violations failing it, and a contrast test checks every text/surface Color
Role pair in every scheme and Appearance Preset but Utila, which keeps its
shipped palette by product decision. See
[the contributor guide](../design-system.md).
