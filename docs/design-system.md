# Design System contributor guide

The Design System is the Owned Module in `packages/widget/src/ui/` that holds
every visual decision of the Widget: tokens, themes, the scoped reset,
primitives, components, patterns, icons and artwork. Read this guide before
building or changing any UI. The decision and its rationale are in
[ADR 0015](adr/0015-the-design-system-owns-every-visual-decision.md); the
vocabulary (Design System, Appearance, Color Role, Appearance Preset,
Presentation Setting) is in [the glossary](../GLOSSARY.md).

## Interfaces

- `src/ui/index.ts` is the main interface, for Features and application
  composition: primitives, components, patterns and their finite prop types
  (`Tone`, sizes, type roles).
- `src/ui/composition.ts` is for application composition only: the theme root,
  the portal container, and theme resolution for a color scheme, Appearance
  Preset and Appearance. Application composition passes the theme root the
  resolved color scheme and the Appearance that Widget Configuration carries.

Nothing else under `src/ui/` is importable from outside it. The Design System
imports only its own modules and libraries: nothing from Features, Resources,
services, application composition, Domain, `public-api`, `shared` or
`generated`. Its parts take plain values: formatted strings, URLs, callbacks
and finite choices. A Feature formats its domain values and maps them onto
Design System props.

Only the Design System uses StyleX, Base UI, `motion`, Recharts, TanStack
Virtual and SVG icon markup.

## Tokens

Tokens are StyleX variables defined in the Design System's token definitions.
Their CSS custom properties use a namespace distinct from the legacy `--sk-*`
names. They are not a host contract: hosts theme the Widget only through
`appearance`, and the theme root sets host values as inline custom properties on
the Widget root and the portal container.

### Three tiers

1. **Palette**: raw color ramps. Private to the token definitions; no part reads
   the palette directly.
2. **Color Roles**: the semantic roles every part reads. Hosts can set them per
   color scheme.
3. **Derived roles**: when a host sets only `accent`, then `accentHover`,
   `accentSoft`, `accentText`, `focusRing`, `info` and `infoSoft` are derived
   from it; `successSoft`, `warningSoft` and `dangerSoft` are derived from their
   base role the same way. A host may set any derived role explicitly.

### Color Roles

| Role | Use |
| --- | --- |
| `background` | Widget canvas |
| `surface` | Filled cards, rows, inputs |
| `surfaceHover` | Hover on interactive surfaces |
| `surfaceRaised` | Menus, popovers, token trigger |
| `border` | Dividers |
| `borderStrong` | Outlined cards and inputs |
| `text` | Primary text |
| `textMuted` | Secondary text |
| `textSubtle` | Disabled and decorative text only |
| `accent` / `accentHover` | Primary actions and their hover |
| `onAccent` | Text on accent |
| `accentSoft` | Chips, KYC badge, selection tint |
| `accentText` | Links, chip text |
| `success` / `successSoft` | Positive rates and claimable amounts only |
| `warning` / `warningSoft` | Pending, risk, KYC notice |
| `danger` / `dangerSoft` | Errors, action required |
| `info` / `infoSoft` | Informational notices |
| `focusRing` | Focus indicator |
| `scrim` | Overlay backdrop |

Rules:

- The accent is the same hue in light and dark.
- Status colors appear as text or icons on their soft tint, never as white text
  on a solid status fill.
- Text roles keep at least 4.5:1 contrast on every surface role they sit on, and
  focus rings and non-text indicators at least 3:1, in every color scheme and
  Appearance Preset. The contrast test enforces this; a new role pair joins it.
- `textSubtle` is never used for information the user needs.

### Type roles

Sizes are in px, so the host's root font size does not scale them. Each role
fixes size, line height and weight together.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display` | 32/40, tabular | 600 | Amount input; shrinks 32 → 28 → 24 → 20 as it fills |
| `title` | 20/28 | 600 | Dialog titles, yield name |
| `heading` | 16/24 | 600 | Section headings |
| `metric` | 18/24, tabular | 600 | Metric values |
| `body` | 14/20 | 400 | Default text |
| `label` | 13/18 | 500 | Field labels, tabs, metric labels |
| `caption` | 12/16 | 400 | Metadata, helper text |
| `overline` | 11/16, uppercase | 600 | Group headers |

Amounts, rates and balances use tabular figures. Heading roles require an
explicit `as`, so headings form a real outline.

### Other scales

- **Radius roles**: `badge` 6, `control` 12 (inner segments 8), `card` 16,
  `overlay` 20, `shell` 20, `pill` fully rounded.
- **Spacing**: a 4px grid of 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, plus
  the named insets `gutter` and `section`.
- **Control heights**: `sm` 32, `md` 40, `lg` 48.
- **Elevation**: `raised`, `overlay`, `shell`. In dark, the shell uses a border
  instead of a shadow. Selection is a ring plus a tint, never a shadow.
- **Motion**: 120, 200 and 320 ms with one standard easing; 0 under
  `prefers-reduced-motion`; press feedback scales to 0.98.
- **Container sizes**: `sm` 400, `md` 520, `split` 800. These are the only
  thresholds for in-Widget layout, which responds to container width only.
- **Viewport query**: only for how an overlay is presented: a bottom sheet below
  520px wide, a centered dialog above.
- **Layers**: overlay, modal, dropdown, toast, tooltip, all inside the portal
  container.
- **Tones**: `neutral`, `accent`, `success`, `warning`, `danger`, `info`. Text
  tones: `default`, `muted`, `subtle`, `accent`, `success`, `warning`, `danger`.

## Theme, Host Profiles and Layouts

The theme root applies one theme per color scheme × Appearance Preset, plus one
per Presentation Setting, to the Widget root and the portal container. Host
`appearance` values win over the mapped legacy `theme`, which wins over the
Host Profile's Appearance Preset, which wins over the base scheme.

- A Host Profile names an Appearance Preset and may override Presentation
  Settings. Preset values live in the Design System. Components never branch
  on the host variant.
- Layout differences arrive as Presentation Settings (call-to-action size,
  gutter, tabs indicator, surface style), named after the difference. Components
  never read which Layout is active.

## Composing the Design System in Features

Features and application composition:

- render no HTML elements: no lowercase JSX;
- pass no `className` or `style`;
- write no raw values: colors, sizes, spacing, radii, shadows, durations and
  z-indices come only from props that accept tokens;
- import no styling or behavior library;
- import the Design System only through `src/ui/index.ts` (application
  composition also through `src/ui/composition.ts`).

Primitives accept layout and text props only: no color, border, margin,
`className` or `style`. `Box`, `Stack` and `Grid` take spacing-scale values and
named widths; `Text` takes a type role and tone; `as` accepts a fixed list of
elements. Components and patterns take finite `tone`, `size` and `variant`
props, so the compiler lists the looks that exist.

A layout value can vary with the container's width: pass
`{ base, sm, md, split }` instead of a single value, for example
`<Stack direction={{ base: "column", md: "row" }} />`. `base` applies at every
width and each other key from its container size up. The Widget root is the
size container, so in-Widget layout never reads the viewport.

Icons come from one component, `<Icon name="CopyIcon" />`, in sizes `sm`, `md`
and `lg` (16, 20, 24) and the text tones; unset, an icon draws in the
surrounding text color. Every icon name ends in `Icon`, and the SVG markup lives
only in `src/ui/icons/`. A new icon joins that set; Features never draw SVG.

A component shaped by one Feature, such as a Feature's details pane or metric
card, lives in that Feature and composes Design System parts. It still follows
the rules above.

## Extending instead of working around

When the Design System lacks something a screen needs, extend it; do not work
around it in the Feature.

1. Prefer an existing part with a new variant, tone or size over a new part.
2. Name the part after what it is visually, never after a Feature, Host
   Profile or Layout, and without an `SK` prefix. Icons are named `*Icon`.
3. Build interactive behavior on the matching Base UI part. Popups render into
   the portal container.
4. Style only with StyleX and tokens. Values computed at runtime (a marker
   position, a virtualizer size, an auto-shrinking amount) use StyleX dynamic
   styles.
5. Omit `className` and `style` from the part's props, and make `as` a finite
   union.
6. Add a token or Color Role in the token definitions when no existing one
   fits; a new text/surface pair joins the contrast test.
7. Export the part from `src/ui/index.ts`.
8. Add its stories.

Do not suppress a design-system rule to ship a screen. A suppression is a
deliberate exception and states its reason after ` -- `, for example
`// ast-grep-ignore: no-raw-design-value -- <why no token fits>`.

## Enforcement

`pnpm lint` and `pnpm check-hygiene` enforce the rules above:

- dependency-cruiser keeps StyleX, Base UI, `motion`, Recharts, TanStack
  Virtual and the legacy styling libraries (vanilla-extract, Radix and its
  internals, clsx, the skeleton library) inside `src/ui/`
  (`design-system-owns-styling-libraries`), and style modules (`*.stylex.ts`,
  `*.css.ts`, `.css`) too (`design-system-owns-style-modules`). It keeps other
  owners on the main interface (`design-system-internals-private`), lets only
  application composition use the composition interface
  (`design-system-composition-importers`), and lets `src/ui/` import only
  itself (`layer-ui`). These run in `check-hygiene`.
- ast-grep rejects lowercase JSX elements and `createElement` calls with a
  lowercase tag (`no-html-element-outside-design-system`) and `className` or
  `style`, as attributes or spread
  (`no-class-name-or-style-outside-design-system`), in Features and
  application composition, and, inside `src/ui/` outside the token definitions
  (`src/ui/tokens/`, the theme definitions in `src/ui/theme/*.ts`) and artwork
  (`src/ui/artwork/`), color literals (`no-color-literal-in-design-system`) and
  raw font sizes, weights, line heights, radii, shadows, z-indices, durations
  and px, rem, em, ch, vw and vh lengths in StyleX definitions
  (`no-raw-design-value`; `1em`, `100vw` and `100vh` stay allowed).
  `no-unexplained-design-system-suppression` fails a suppression of these
  rules, or of StyleX's lint rules, without a reason.
- oxlint runs StyleX's lint rules (valid styles, unused styles, valid
  shorthands, sorted keys) on `src/ui/`:
  `pnpm --filter @stakekit/widget lint:stylex`.

During the migration, files that have not moved yet are listed in
`packages/widget/scripts/architecture/design-system-allowlist.ts` with the
rules they break. `pnpm --filter @stakekit/widget check:design-system-allowlist`
(part of `lint`) fails on an offender the list does not name, on an entry that
no longer offends, and on an entry (file and rule) that the list at the merge
base with `main` does not have, so the list only shrinks. Without git or a
`main` branch it skips that comparison and says so. After migrating a file,
delete its entry and run the check with `--write`, which copies the list into
the ast-grep rules' `ignores`.

## Artwork

Brand artwork (the logo, the Morpho mark) and the generated-avatar palette live
in the Design System as artwork, in `src/ui/artwork/`. They are exempt from the
color-literal rule by location, and their colors never leak into controls or
Color Roles.

## Stories

Every primitive, component, variant and pattern has a Storybook story beside
it. Stories run as Chromium tests: an accessibility violation or an unexpected
console error fails them. Play functions cover keyboard operation, the disabled
state, open and close, focus return and selection. A change to a part's
variants, sizes or states updates its stories in the same change.
