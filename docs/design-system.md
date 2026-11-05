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

## Parts

`src/ui/index.ts` exports:

- **Primitives**: `Box`, `Stack`, `Grid`, `Text`, `Icon`, `InlineIcon`,
  `VisuallyHidden`.
- **Components**: `AlertDialog`, `AmountInput`, `AnimatedNumber`, `Avatar`,
  `IconAvatar`, `TokenAvatar`, `Badge`, `Button`, `Card`, `Checkbox`,
  `ChipGroup`, `CopyButton`, `DetailList`, `DetailRow`, `Disclosure`,
  `Divider`, `EmbeddedPage`, `ExternalLink`, `Field`, `IconButton`,
  `InfoTip`, `ListGroup`, `ListRow`, `Meter`, `Metric`,
  `MetricGroup`, `Modal`, `Notice`, `ScrollArea`, `SegmentedControl`, `Select`,
  `Skeleton`, `Spinner`, `Switch`, `Tabs`, `TimeSeriesChart`, `Tooltip`,
  `VirtualList`.
- **Patterns**: `ActionCard`, `AmountPanel`, `AssetHeader`, `CompleteSummary`, `EmptyState`, `Entrance`,
  `ErrorState`, `FlowSteps`, `ListSkeleton`, `PageHeader`, `PageTransition`,
  `ReviewSummary`, `SelectSheet`, `SplitView`, `StandIn`, `TokenTrigger`,
  `WidgetFrame`.
- **Artwork**: `MorphoMark`, `Spot` (a flat illustration: one icon of the
  set on a tone's soft disc, used by `EmptyState`, `ErrorState` and dialogs
  instead of raster artwork).
- **Prop types**: `Tone`, `IconName`, `HostHook`, `TabOption`, `ToggleOption`,
  `SplitViewSide`.

A part added to or removed from `src/ui/index.ts` updates this list. Parts used
only inside the Design System stay unexported until a Feature needs them.

One look per concept:

- **List rows.** `ListRow` has one look per context. Lists of what the user
  owns or did (positions, activity) use `card` rows: a filled surface each,
  8px apart, a selection ring when selected. Pickers (every `SelectSheet`,
  the network, account and wallet lists) use `flat` rows: no surface until
  hovered, then the accent tint with a trailing check for the choice, so hover
  and selection never look alike; their content lines up with the sheet's
  title while the tint reaches past it. Condensed rows are always flat.
- **Action cards.** An action a position offers, such as Claim, Withdraw or a
  borrow position's Repay, is one `ActionCard`: a filled card with the
  summary beside a small `soft` button that names the verb. Sibling action
  cards sit 8px apart; the button keeps its row at every width.
- **Step indicator.** `Steps` (and `FlowSteps` over it) draws every step as a
  24px disc: waiting is a ring on the surface, the step under way an accent
  spinner, a step waiting for the wallet's signature a wallet glyph on the
  accent tint, done a success outline check, failed a danger outline cross.
  A finished step's connector turns success; accent stays with the current
  step.

## Tokens

Tokens are StyleX variables defined in the Design System's token definitions.
Their CSS custom properties are not a host contract: hosts theme the Widget
only through `appearance`, and the theme root sets host values as inline custom
properties on the Widget root and the portal container.

### Three tiers

1. **Palette**: raw color ramps. Private to the token definitions; no part reads
   the palette directly.
2. **Color Roles**: the semantic roles every part reads. Hosts can set them per
   color scheme.
3. **Derived roles**: when a host sets only `accent`, then `onAccent`,
   `accentHover`, `accentSoft`, `accentText`, `focusRing`, `info` and
   `infoSoft` are derived from it; `successSoft`, `warningSoft` and
   `dangerSoft` are derived from their base role the same way. `onAccent` is
   whichever of the scheme's `onAccent` and dark text contrasts more with an
   opaque hex or `rgb()` accent (the scheme's otherwise), and hover moves the
   accent away from it. A host may set any derived role explicitly.

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
| `accentSoft` | Chips, selection tint, accent cards and notices, marked text |
| `accentText` | Links, chip text |
| `success` / `successSoft` | Positive rates and claimable amounts only; a rate of zero or none is `textMuted`, shown as "—" |
| `warning` / `warningSoft` | Action required (rewards to claim among it, and the Manage tab's count), a jailed or inactive validator, risk, KYC notice |
| `danger` / `dangerSoft` | Errors and failures; on an invalid amount, only the line that says why |
| `info` / `infoSoft` | Informational notices; pending requests and positions in progress |
| `focusRing` | Focus indicator |
| `scrim` | Overlay backdrop |

Rules:

- The accent is the same hue in light and dark.
- Status colors appear as text or icons on their soft tint or straight on a
  surface role, such as a `ListRow`'s status line, never as white text on a
  solid status fill. Each status text role is checked on every surface role
  as well as its tint.
- A soft `Badge` sits on rows and cards, not the canvas, so it mixes its tone's
  text color into `surface` by the `badgeTint` weights: a faint fill that keeps
  the text at 4.5:1, and a 1px edge at least 1.5:1 on every surface.
- Text roles keep at least 4.5:1 contrast on every surface role they sit on, and
  focus rings and non-text indicators at least 3:1, in every color scheme and
  Appearance Preset. The contrast test enforces this; a new role pair joins it.
- A filled `surface` stands at least 1.15:1 off `background`, so a card's edge
  reads without a border, in every color scheme and Appearance Preset whose
  surfaces are filled. The contrast test enforces this too.
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
  instead of a shadow, and a raised surface adds a `borderStrong` outline.
  Selection is a ring plus a tint, never a shadow; hover is `surfaceHover`
  alone, never the selection.
- **Disabled**: a control that cannot be used keeps its variant and state at
  the `disabled` opacity (40%), so a disabled primary button still reads as
  the primary action and a disabled switch as on or off; a busy button keeps
  its full look.
- **Motion**: 120, 200 and 320 ms with one standard easing; 0 under
  `prefers-reduced-motion`; press feedback scales to 0.98. Parts animated with
  `motion` (`AnimatedNumber`, `PageTransition`) read the same values in
  seconds from `ui/tokens/motion-timing.ts`, read the preference themselves and
  show their final state at once under reduced motion.
- **Container sizes**: `sm` 400, `md` 520, `split` 800. These are the only
  thresholds for in-Widget layout, which responds to container width only. A
  property that reads a value at more than one size uses `containerBand`, whose
  queries do not overlap: overlapping queries of equal specificity resolve by
  source order, which StyleX does not guarantee.
- **Viewport query**: only for how an overlay is presented: a bottom sheet below
  520px wide, a centered dialog above.
- **Layers**: overlay, modal, dropdown, toast, tooltip, all inside the portal
  container, plus `sticky` for in-flow content that sticks over scrolling rows,
  such as a `VirtualList` group title.
- **Tones**: `neutral`, `accent`, `success`, `warning`, `danger`, `info`. Text
  tones: `default`, `muted`, `subtle`, `accent`, `success`, `warning`, `danger`.

## Theme, Host Profiles and Layouts

The theme root applies one theme per color scheme × Appearance Preset, plus the
Presentation Settings, to the Widget root and the portal container. Host
`appearance` values win over the mapped legacy `theme`, which wins over the
Host Profile's Appearance Preset, which wins over the base scheme. An `inline`
theme root themes standalone content placed in a host's own layout, such as the
public `HelpModal` among `SKApp` children: its root and content generate no
box and are no size container, so the content flows as if unwrapped.

- A Host Profile names an Appearance Preset and may override Presentation
  Settings. Preset values live in the Design System. Components never branch
  on the host variant.
- A preset may fix the color scheme (Porto dark, Utila light); the requested
  scheme then does not apply. Preset palettes sit beside the scheme roles in
  `ui/theme/color-schemes.ts`: a StyleX theme replaces any other theme over the
  same variables on an element, so a dark palette is built over every dark role.
- Layout differences arrive as Presentation Settings (call-to-action size,
  gutter, tabs indicator, surface style), named after the difference. Components
  never read which Layout is active.
- Call-to-action size and gutter are values: themes over the `callToAction`
  and `gutter` variable groups, one group per setting so their themes compose.
  Tabs indicator (`underline`, `pill`) and surface style (`filled`,
  `elevated`) change which styles apply: the theme root and the portal container
  carry `data-sk-tabs-indicator` and `data-sk-surface-style` with
  `presentationMarker`, and a component reads one with
  `stylex.when.ancestor('[data-sk-tabs-indicator="pill"]', presentationMarker)`
  in its own style map. Components never take them as props.

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

A leading icon never indents a block of text. On a note, callout or status
line it sits inline at the start of the first line, so wrapped lines, bodies
and actions start at the text's own left edge: `<Text icon="InfoIcon">` for an
icon, an untitled `Notice`, or `InlineIcon` inside a `Text` for a spinner. This
holds for a stack of separate notes too, such as a position's exit notes. Only
a list of facts that each carry their own icon, such as a yield's meta-info
list (swap, history, gift, info), keeps the icons in a column, as bullets.

A component shaped by one Feature, such as a Feature's details pane or metric
card, lives in that Feature and composes Design System parts. It still follows
the rules above.

Numbers reach the Design System already formatted, by the one formatter in
`src/shared/lib/number-format.ts`, which keeps values exact (ADR 0006) and
only shapes their display:

- token amounts: at most four decimals at every magnitude, trailing zeros
  dropped; a non-zero amount below 0.0001 reads `<0.0001`, never 0. Narrow
  places use the compact form from 1,000 ("1.23K").
- USD: two decimals below 1,000, compact from 1,000 ("$1.25K"); below a cent
  `<$0.01`.
- percents: reward rates and commissions rounded to two places; a non-zero
  rate that rounds to zero reads `<0.01%`.
- a chart's value axis uses one decimal count, and for USD one compact unit,
  for all its ticks (`formatPercentAxis`, `formatUsdAxis` into
  `TimeSeriesChart`'s `formatValueAxis`).
- negative figures use the minus sign `−` (U+2212); a figure that moves reads
  `before → after`; an unknown or unavailable figure reads `—`
  (`unavailableFigure`).

`AmountInput` keeps the integer part grouped while typing, and refuses text
that reads as another language's decimal separator (`123,45` in English)
rather than regrouping it. Max fills the exact maximum the Feature allows (the
balance, or less where a limit or gas reserve applies), and that exact amount
is what is validated and submitted: display never rounds it, so Max never
submits more than the balance. When the amount does not fit the input even at
the smallest `display` step, the unfocused input shows only the fraction
digits that fit, rounded down but never past the first non-zero digit, so a
non-zero amount never reads 0; focusing shows every digit again.

Hosts and tests locate elements by `data-rk`. A part that takes `hostHook`
renders it as `data-rk`; the values are the `HostHook` union in
`src/ui/host-hook.ts`, and a new value joins that union. No other `data-rk`
value is rendered.

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

- dependency-cruiser keeps StyleX, Base UI, `motion`, Recharts and TanStack
  Virtual inside `src/ui/` (`design-system-owns-styling-libraries`), and style
  modules (`*.stylex.ts`, `.css`) too (`design-system-owns-style-modules`). It
  keeps other owners on the main interface (`design-system-internals-private`),
  lets only application composition use the composition interface
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

Every rule applies to every file; the only exceptions are suppressions that
state their reason.

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
