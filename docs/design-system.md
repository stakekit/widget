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
  which themes the Widget root and the portal container inside it, theme
  resolution for a color scheme and Appearance Preset, and the Presentation
  Settings the theme root applies. Application composition passes the theme
  root the resolved color scheme and the Appearance that Widget Configuration
  carries.

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
- **Patterns**: `ActionCard`, `AmountPanel`, `AssetHeader`, `CompleteSummary`,
  `EmptyState`, `Entrance`, `ErrorState`, `FlowSteps`, `ListSkeleton`,
  `PageHeader`, `PageTransition`, `PositionSummary`, `ReviewSummary`,
  `SelectSheet`, `SplitView`, `StandIn`, `TokenTrigger`, `WidgetFrame`.
- **Artwork**: `MorphoMark`, `Spot` (a flat illustration: one icon of the
  set on a tone's soft disc, used by `EmptyState`, `ErrorState` and dialogs
  instead of raster artwork).
- **Prop types**: `Tone`, `FixedIconName`, `HostHook`, `TabOption`,
  `ToggleOption`, `AmountPanelNote`, `SelectSheetAction`.

A part added to or removed from `src/ui/index.ts` updates this list. Parts used
only inside the Design System stay unexported until a Feature needs them.

One look per concept:

- **List rows.** `ListRow` has one look per context. Lists of what the user
  owns or did (positions, activity) use `card` rows: a filled surface each,
  8px apart, a selection ring when a button row is selected, read as
  pressed. Pickers (every `SelectSheet`,
  the network, account and wallet lists) use `flat` rows: no surface until
  hovered, then the accent tint with a trailing check for the choice, so hover
  and selection never look alike; their content lines up with the sheet's
  title, or a condensed `ListGroup`'s heading, while the tint reaches past
  it. Every row of a choice keeps the check's slot, chosen or not, so values
  line up. Condensed rows are always flat. On the second line the subtitle
  keeps its room: a status truncates first, and below `sm` shows its icon
  alone. A value that did not happen (a failed transfer) is muted and struck
  through (`valueStruck`). A row may end with a control of its own
  (`trailing`), such as a collateral `Switch`, which keeps its own press on
  a static row, and carry a `note` under its main line, inside its surface,
  such as why that switch cannot change (`danger`) or a risk (`warning`).
- **Pickers.** A `SelectSheet` with a search field holds its height (the
  dialog's cap), so the field and the sheet's top never move as matches
  change, and an empty or failed search shows its state where the options
  were. Every search field has a placeholder that says what it searches
  ("Search tokens"; unset, its label). With a coarse pointer the field does
  not take focus on open, so no on-screen keyboard covers the options.
- **Overlays.** A bottom sheet (below the 520px viewport) shows a grab
  handle: dragging it or the header down past a third of the sheet, or
  flicking it, closes the sheet; a shorter drag settles back, at once under
  reduced motion. `InfoTip` and `Tooltip` stay inside the dialog they open
  from, else the Widget's frame (`data-sk-frame`), else the Widget root,
  flipping or shifting rather than passing its edge; an `InfoTip` may hold a
  few paragraphs and a source link.
- **Scrolling panes.** `ScrollArea` and `VirtualList` fade an edge that cuts
  content off, deeper (up to 24px) the more lies past it, so a clipped pane
  reads as scrolling; a sticky group title marks the top instead, and
  keyboard focus on the pane lifts the fades so its ring shows whole. Both
  panes take the fades, the 24px scroll padding that brings a control
  scrolled into view clear of them, and their height caps from one
  definition (`scrollPaneStyles`, `scrollPaneMaxHeightStyles`), each setting
  the fade depths (`scrollFadeVars`) from its own measure.
  Every scrolling pane keeps its scrollbar's gutter whether or not its
  content overflows, so content that grows past the edge, such as a
  disclosure opening in a `SplitView` pane or a `SelectSheet` list filling
  back in, never narrows or shifts when the scrollbar appears or goes. An
  element that scrolls with the browser's scrollbar (`VirtualList`, a
  `Modal` body, `Box overflow="auto"`) applies `scrollStyles.stableGutter`
  (`scrollbar-gutter: stable`, `ui/primitives/scroll.ts`) beside its
  `overflow`; `ScrollArea`, whose overlay scrollbar replaces the browser's,
  always pads its end by its scrollbar's 8px. The gutter sits at the end
  edge only, so the start of the content stays aligned with what is above
  it; an overlay scrollbar, such as macOS's default, takes no gutter. Where
  the element can never overflow, no gutter is kept: a stacked `SplitView`
  pane takes its content's height (`scrollAreaVars.restingGutter` set to 0),
  a `Modal` whose content scrolls itself (`contentScrolls`, as
  `SelectSheet`'s list) leaves the gutter to that content, and a `Select`
  list's options never change while it is open.
- **Action cards.** An action a position offers, such as Claim, Withdraw or a
  borrow position's Repay, is one `ActionCard`: a filled card with the
  summary beside a small `soft` button that names the verb. Sibling action
  cards sit 8px apart; the button keeps its row at every width. The action
  the screen leads with, such as a withdrawal that is ready or rewards to
  claim, is `primary`: the card tints in the accent and its button fills,
  and the screen's own call to action (Unstake) steps down to secondary, so
  one accent fill leads. A figure paid out to the user reads in `success`.
- **Position details.** A position's page, in both Layouts, reads in one
  order: the `AssetHeader` (logo, name, "via Provider · Network"; the
  positions list's row carries the status, not the page), then a
  `PositionSummary` card with what the position is worth as the hero, its
  token amount under it and its reward rate as a `success` outline `Badge`
  beside it ("4.06% APY"). Under a divider, label-value rows: "Earned · last
  7 days" and "Earned · all time", each signed in `success` or `danger`, in
  USD with the token amount in a muted caption where the position prices the
  token and in the token otherwise, the all-time row with an `InfoTip`
  saying it is tracked since the wallet was first indexed and updated hourly
  (both are left out, silently, when the API does not track the yield, every
  window is zero or the request fails); then "Projected · per year", muted
  with "≈", left out under a cent a year, as for a dust or unpriced
  position. Every row has one alignment: labels at the start, values at the
  end. One-click `ActionCard`s (claim, withdraw what is unlocked,
  other pending actions) come next, only when the position has them, so a
  required action stays in view. The amount actions follow as `Tabs`
  (Unstake or Withdraw, selected first, and Stake or Deposit where the Layout
  offers entering; with one action, no tabs, its form alone), the selected
  action's form in their panel. Everything else about the position (the
  balance breakdown, the rate's composition, validators) sits in one
  `Disclosure`, "Details", open by default, never repeating a figure
  the summary shows; each validator there is a filled `Card` of its own,
  8px apart, with no dividers: its logo and "Staked via …" lead, and its
  facts open in a `Disclosure` inside the card. The yield's facts follow
  the Details. In the Dashboard the
  Manage tab is the positions list alone, full width under its summary, and
  a position opens its own page laid out as the Earn tab is: a `SplitView`
  with the trail back to the positions list, the header and the actions on
  the left, and the summary, the Details and the yield's facts on the
  right. A flow started from an action runs its Review, Steps and Complete
  in the left pane while the right keeps the position. A borrow market
  position follows the same order: its
  net worth leads the `PositionSummary` with the collateral value under it,
  debt and health factor (in the risk band's tone) beside it and the loan to
  value `Meter` inside; a liquidation-risk `Notice` sits right under the
  summary; Repay (selected first) and Withdraw are the amount tabs; the
  collateral with its switches and the market's terms fill the
  Details.
- **Yield facts.** What a yield is reads the same wherever it shows: one
  `YieldFactsSection` (yield-summary), an "About" `Disclosure`, open, with
  the yield's description and documentation link, then its facts (reward
  rate, reward token, price per share, risk, minimum, cooldown, warmup,
  lockup, withdrawal, TVL, fees, status, average position, type, reward
  schedule and claiming, website) and its copyable contracts. The Earn
  details pane and a position's page both end with it, each leaving out the
  facts it already shows: Earn's metric cards, a position's summary rate.
  The header names the provider and the network, so the facts never do.
- **Named entities in rows.** A label-value row whose value names a
  network, a token, a provider, a yield or one validator leads the value
  with its logo (`DetailRow`'s `logo`, an `xs` avatar; square for a
  validator), the name's initials where there is no logo. A network's logo
  follows the host's icon mapping and is left out where the host hides
  network logos. A list of several names, and an amount that only carries a
  symbol, stay text.
- **Step indicator.** `Steps` (and `FlowSteps` over it) draws every step as a
  24px disc centred in a 32px marker column (an `md` avatar's width), so the
  `FlowSteps` summary avatar lines up with the discs: waiting is a ring on
  the surface, the step under way an accent arc turning on its ring, a step
  waiting for the wallet's signature a wallet glyph on the accent tint with a
  slow halo pulsing out behind it, done a success outline check, failed a
  danger outline cross, and a request the user declined in the wallet a
  muted dash on the waiting ring with a muted state line: cancelling is not
  an error, so only a real failure reads in `danger`. The connector below
  a step under way fills in the accent by its stage, a third while it is
  submitted and two thirds while it is confirmed; a finished step's connector
  turns success. Under reduced motion the arc and the halo hold still and the
  fill changes at once. A transaction shows its shortened hash beside its
  explorer link from the moment it is sent. `FlowSteps` adds, under the
  steps, a card asking to check the wallet while a signature is awaited, and
  a card of the flow's details.

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
   `accentHover`, `accentSoft`, `accentText` and `focusRing` are derived from
   it; `successSoft`, `warningSoft`, `dangerSoft` and `infoSoft` are derived
   from their base role the same way. `info` is a hue of its own, not the
   accent's, so a host accent leaves `info` and `infoSoft` as shipped; only a
   host's own `info` derives `infoSoft`. `onAccent` is
   whichever of the scheme's `onAccent` and dark text contrasts more with an
   opaque hex or `rgb()` accent (the scheme's otherwise), and hover moves the
   accent away from it until it stands at least 1.2:1 off the accent, keeping
   `onAccent` at 4.5:1 (an accent already at that end moves toward `onAccent`
   instead). Every shipped `accentHover` stands at least 1.15:1 off its
   accent. A host may set any derived role explicitly.

### Color Roles

| Role                      | Use                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `background`              | Widget canvas                                                                                                                                                                        |
| `surface`                 | Filled cards, rows, inputs                                                                                                                                                           |
| `surfaceHover`            | Hover on interactive surfaces, at least 1.12:1 off the fill it replaces                                                                                                              |
| `surfaceRaised`           | Menus, popovers, token trigger                                                                                                                                                       |
| `border`                  | Dividers                                                                                                                                                                             |
| `borderStrong`            | Outlined cards and inputs                                                                                                                                                            |
| `text`                    | Primary text                                                                                                                                                                         |
| `textMuted`               | Secondary text                                                                                                                                                                       |
| `textSubtle`              | Disabled and decorative text only                                                                                                                                                    |
| `accent` / `accentHover`  | Primary actions and their hover                                                                                                                                                      |
| `onAccent`                | Text on accent                                                                                                                                                                       |
| `accentSoft`              | Chips, selection tint, accent cards and notices, marked text                                                                                                                         |
| `accentText`              | Links, chip text                                                                                                                                                                     |
| `success` / `successSoft` | Positive rates, claimable amounts and an estimate of what an amount earns ("+$6.08 / yr"); a rate of zero or none is `textMuted`, shown as "—"                                       |
| `warning` / `warningSoft` | Action required (rewards to claim among it, and the Manage tab's count), a jailed or inactive validator, risk, KYC notice, a balance that cannot fund any amount before one is typed |
| `danger` / `dangerSoft`   | Errors and failures; on an invalid amount, only the line that says why and the amount panel's edge                                                                                   |
| `info` / `infoSoft`       | Informational notices; pending requests and positions in progress. A sky blue of its own, never the accent's hue                                                                     |
| `focusRing`               | Focus indicator, a ring outside the edge past a gap (see Other scales)                                                                                                               |
| `scrim`                   | Overlay backdrop                                                                                                                                                                     |

Rules:

- The accent is the same hue in light and dark. The default preset's neutrals
  lean slightly toward it, and its light shadows are cast in a deep shade of
  it, so greys and accent read as one palette.
- `info` keeps its own hue, at least 25° from the accent's in every color
  scheme and Appearance Preset that ships its accent, so an informational
  notice never reads as a selected control or an accent card. Utila is the
  exception: it keeps its shipped `info` (`#3448E6`), beside its accent, as
  its palette ships.
- Status colors appear as text or icons on their soft tint or straight on a
  surface role, such as a `ListRow`'s status line, never as white text on a
  solid status fill. Each status text role is checked on every surface role
  as well as its tint.
- A soft `Badge` sits on rows and cards, not the canvas, so it mixes its tone's
  text color into `surface` by the `badgeTint` weights: a faint fill that keeps
  the text at 4.5:1, and a 1px edge at least 1.5:1 on every surface.
- A `soft` button's and a `Chip`'s tint nearly matches the `surface` of the
  card it sits on, and a tint deep enough to stand off it would drop its
  accent text below 4.5:1, so each has a 1px edge too: its label color mixed
  into `surface` by `softControlTint.edge`, at least 1.5:1 on every surface.
  A selected chip's edge is the accent instead.
- Text roles keep at least 4.5:1 contrast on every surface role they sit on, and
  focus rings and non-text indicators at least 3:1, in every color scheme and
  Appearance Preset. The contrast test enforces this; a new role pair joins it.
  Utila is exempt: it keeps the palette it ships with on `main`, whose
  secondary text and light accent chips read below these thresholds, by
  product decision. Its card edges are still checked.
- A filled `surface` stands at least 1.15:1 off `background`, so a card's edge
  reads without a border, in every color scheme and Appearance Preset whose
  surfaces are filled. The contrast test enforces this too.
- `surfaceHover` stands at least 1.12:1 off the fill it replaces (`surface`,
  or `surfaceRaised` where surfaces are elevated), so hover reads as a change.
- `textSubtle` is never used for information the user needs.

### Type roles

Sizes are in px, so the host's root font size does not scale them. Each role
fixes size, line height, weight and tracking together.

| Role       | Size / line height      | Weight          | Use                                                          |
| ---------- | ----------------------- | --------------- | ------------------------------------------------------------ |
| `display`  | 32/40, tabular, −0.02em | 600             | Amount input; shrinks 32 → 28 → 24 → 20 as it fills          |
| `title`    | 20/28                   | 600             | Dialog titles, yield name, a summary's lead metric (tabular) |
| `heading`  | 16/24                   | 500 (Utila 600) | Section headings                                             |
| `metric`   | 18/24, tabular          | 600             | Metric values                                                |
| `body`     | 14/20                   | 400             | Default text                                                 |
| `label`    | 13/18                   | 500             | Field labels, tabs, metric labels                            |
| `caption`  | 12/16                   | 400             | Metadata, helper text                                        |
| `overline` | 11/16, uppercase        | 600             | Group headers                                                |

Amounts, rates and balances use tabular figures. Heading roles require an
explicit `as`, so headings form a real outline.

The weights are the `fontWeight` scale's: `semibold` for the title, metric
and overline, `medium` for the label, `regular` for body and caption;
`display` reads `figureWeight.display` and `heading` reads
`roleWeight.heading`, the scale's `medium`, so a title stands a step above a
heading. Utila keeps its headings `semibold`, as it ships. A preset lightens
the scale (Finery's `semibold` is 500, Porto's scale 300/400/500). Large
`display` figures draw tighter (`tracking.display`).

Fonts are system stacks; no webfont is loaded. `font.sans` sets text: the
system UI stack by default, a humanist stack under Finery (Seravek, Gill Sans
Nova, Ubuntu, Calibri) and a geometric one under Porto (Avenir, Montserrat,
Corbel). `font.figure` sets figures, the `display` and `metric` roles and
tabular text (`numeric`, the amount input): the sans stack, except Porto's
monospace numerals (`font.mono`). A host's `font.sans` wins over a preset's
and sets figures too.

### Other scales

- **Radius roles**: `badge` 6, `control` 12 (inner segments 8), `card` 16,
  `overlay` 20, `shell` 20, `pill` fully rounded for round marks (avatars,
  spinners, dots, switches), and `pillControl`, fully rounded by default, for
  pill-shaped controls (chips, pill tabs, token and wallet triggers), which a
  preset with tight corners rounds as its controls. Buttons and icon buttons
  round by their size (`controlRadius`): `lg` is the `control` radius, `md`
  five sixths of it and `sm` two thirds (12, 10 and 8 by default), derived on
  the theme root from the preset's or host's `control`, so a small button
  keeps the curve of the larger ones rather than reading as a pill.
- **Spacing**: a 4px grid of 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, plus
  the named insets `gutter` and `section`.
- **Control heights**: `sm` 32, `md` 40, `lg` 48. A `Tabs` list and the
  wallet header's pills beside it are 40 tall (`tokenTriggerHeight.tabs`).
  A condensed `ListRow` is at least 40 tall (`listRowHeight.condensed`).
- **Geometry read by script**: a value Base UI or a virtualizer takes as a
  number is still a token, read in pixels with `Number.parseFloat`, so styles
  and script never hold two copies: a condensed row's height, a virtualized
  picker's row estimate, and how far a popup stands off its anchor
  (`popupOffset`: `hint` 8 for a `Tooltip` or an `InfoTip`, `list` 4 for a
  `Select`'s list).
- **Hit areas**: under a coarse pointer (`pointer.coarse`), a control's hit
  area reaches 44px each way (`hitArea.coarse`) without changing its drawn
  size: `hitAreaStyles.coarse` adds an invisible `::before` centered on it.
  `Button` and `IconButton` take it, as do small controls such as chips,
  tabs, switches and checkboxes.
- **Focus and selection**: focus is a 2px `focusRing` line outside the edge,
  past a 2px gap where the canvas shows (`focusRing`); selection is a 2px
  ring inside the edge (`selectionRing`) plus the accent tint. They may share
  a color, so they differ by shape. A focused selected surface keeps its
  selection ring: its ring becomes two lines, the selection ring inside the
  edge and the focus ring outside it. A selectable row that a scrolling or
  clipping container would cut off draws focus inside its edge as two 2px
  lines and the gap between them (`focusRing.insetStyle`, `insetWidth`,
  `insetOffset`, applied by `interactiveStyles.inset`), where the selection
  ring is one line; a selected row takes `interactiveStyles.insetSelected`,
  whose focus ring replaces its selection ring over the tint. A part never
  marked by a selection ring, such as a tab or a disclosure, draws one line
  just inside its edge instead (`focusRingStyles.inset`). The contrast test
  holds the ring at 3:1 on every surface and on the selection tint, and the
  shapes apart.
- **Elevation**: `raised`, `overlay`, `shell`. In light, the default shadows
  are tinted toward the accent. In dark, the shell uses a border instead of a
  shadow, a raised surface adds a `borderStrong` outline, and overlays add a
  `border` edge so a dialog stands off the scrim. Selection is a ring plus a
  tint, never a shadow; hover is `surfaceHover` alone, never the selection.
- **Disabled**: a control that cannot be used keeps its variant and state at
  the `disabled` opacity (40%), so a disabled switch still reads as on or off.
  A disabled primary or soft button instead takes the `surfaceHover` fill
  under a `textMuted` label at full opacity: its label often says why it is
  disabled ("Enter an amount"), and an accent faded to 40% leaves it
  unreadable in dark and on many host accents. A busy button keeps its full
  look.
- **Motion**: 120, 200 and 320 ms with one standard easing; 0 under
  `prefers-reduced-motion`; press feedback scales to 0.98, and a filled
  button's fill also changes while pressed (`pressTint`: the primary deepens
  past its hover, a soft or danger fill takes a little of its label color).
  Loops have their own durations, also 0 under reduced motion: `spin` (800 ms)
  for a spinner's turn, `pulse` (1600 ms) for a skeleton's breath, `halo`
  (2400 ms) for a signing step's halo. Parts animated with
  `motion` (`AnimatedNumber`, `PageTransition`) read the
  same values in seconds from `ui/tokens/motion-timing.ts`, read the
  preference themselves and show their final state at once under reduced
  motion. An
  `AnimatedNumber` shows its value at once when it mounts and counts only to
  a value that changes while it shows, so returning to a screen never
  replays a count. Keyframes that more
  than one part plays, such as `drawIn` for a drawn check, live once in
  `ui/tokens/keyframes.stylex.ts`.
- **Container sizes**: `sm` 400, `md` 520, `split` 960. These are the only
  thresholds for in-Widget layout, which responds to container width only.
  Each query reads the nearest size container: the Widget root and each
  `SplitView` pane are size containers, so a part inside a pane lays out by
  the pane's width, and whether a `SplitView` splits reads the frame's.
  Below `split` the Dashboard stacks in one column: a `SplitView` puts its
  secondary pane under the primary one; and a `wide` `WidgetFrame` holds its
  header in the same centred column as the page. A property that reads a value at more
  than one size uses `containerBand`, whose queries do not overlap:
  overlapping queries of equal specificity resolve by source order, which
  StyleX does not guarantee.
- **Viewport query**: only for how an overlay is presented: a bottom sheet below
  520px wide, a centered dialog above. `WidgetFrame` alone measures the
  viewport, to drop its corners and edge when it is as wide as the screen.
- **Shell**: the frame keeps a least height per Layout (`frameMinHeight`),
  so a short page, such as an empty list or an error, centers in it instead
  of shrinking the Widget; a taller page grows the frame, which scrolls with
  the host page, its call-to-action at the page's foot. Its header
  row (back, wallet controls, disconnect) leaves no band when it has nothing
  to show.
  `Tabs` scroll across where they do not fit, fading the hidden end, with an
  underline rule the full width of the row; tabs, chips and the header's
  pills are at least 44px to a coarse pointer. While a page loads what its
  call-to-action needs, a `cta` `Skeleton` stands in for it: no accent fill
  shows before the action is known.
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
  scheme then does not apply, nor do the host's `appearance` colors for it. A
  mapped legacy `theme`'s colors still apply, in the scheme it was inferred as.
  Preset palettes sit beside the scheme roles in
  `ui/theme/color-schemes.ts`: a StyleX theme replaces any other theme over the
  same variables on an element, so a dark palette is built over every dark role.
- Presets differ beyond color but keep their accents. The default preset
  leans its neutrals toward its blue accent and casts its light shadows in
  it. Finery is elevated and airy: teal-tinted neutrals, white cards on one
  level of soft shadow, softer radii (card 20, control 14), lighter headings
  and a humanist sans. Porto is dark, high contrast and flat: a near-black
  canvas, tight radii (card 6, control and pill controls 4), raised parts
  outlined instead of shadowed, outlined surfaces, pill tabs and a geometric
  sans over monospace figures. Utila is light, crisp and compact: 8px radii
  on controls, pill controls and overlays, 12px cards and a 14px frame,
  outlined surfaces, shorter controls (28/36/40), the `md` gutter and tinted
  tabs, on its own palette as it ships. Radius, font, weight, control height
  and elevation are preset
  themes in `ui/theme/appearance-presets.ts`; the surface style, tabs
  indicator and gutter are the Host Profile's Presentation Settings.
- Layout differences arrive as Presentation Settings (call-to-action size,
  gutter, tabs indicator, surface style), named after the difference. Components
  never read which Layout is active.
- Call-to-action size and gutter are values: themes over the `callToAction`
  and `gutter` variable groups, one group per setting so their themes compose.
  Tabs indicator (`underline`, `pill`, `tint`) and surface style (`filled`,
  `elevated`, `outlined`) change which styles apply: the theme root and the
  portal container carry `data-sk-tabs-indicator` and `data-sk-surface-style` with
  `presentationMarker`, and a component reads one with
  `stylex.when.ancestor('[data-sk-tabs-indicator="pill"]', presentationMarker)`
  in its own style map. Components never take them as props.
- Under `elevated`, filled cards and rows lift off the canvas as
  `surfaceRaised` with the `raised` elevation, so parts inside them (the token
  trigger) stay flat on `surface` and soft badges fill from `surfaceRaised`:
  one level of elevation. Under `outlined`, filled cards and rows (pressable
  ones too) keep their fill and edge
  in `border`. Beside an amount, the token trigger takes its fill, lift and
  corners from the `tokenTrigger` variables, which a preset can theme: Utila
  sets it flat in its card, on the card's fill with a hover tint, and rounds
  it more than its other controls. A `SegmentedControl` marks its choice as
  the tabs do: a raised segment under `pill`, an accent underline under
  `underline`.

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
width and each other key from its container size up. The Widget root and
each `SplitView` pane are size containers, so in-Widget layout never reads
the viewport.

Icons come from one component, `<Icon name="CopyIcon" />`, in sizes `sm`, `md`,
`lg` and `xl` (16, 20, 24, 32) and the text tones; unset, an icon draws in the
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

- token amounts: at most four decimals, trailing zeros dropped, grouped in
  full below 1,000,000 ("1,762.3456") and compact from 1,000,000 ("1.2M"); a
  non-zero amount below 0.0001 reads `<0.0001`, never 0. Amounts shown as a
  pair, such as yearly and monthly rewards, share one decimal count
  (`formatPairedTokenAmounts`: "0.0834" and "0.0070").
- counts and market sizes (users, a TVL in token units, a validator's
  stake): at most two decimals, grouped in full below 1,000,000 ("883.29")
  and compact from 1,000,000 ("76.12M") (`formatCompactNumber`). A card and
  the sheet behind it show the same figure alike.
- USD: exact to the cent below 1,000,000 ("$1,710.42"), compact from
  1,000,000 ("$1.23M"); below a cent `<$0.01`. Every surface (lists, inputs,
  review, receipts, market stats) uses the same rule.
- percents: reward rates, commissions and fees always show two decimals
  ("1.60%", "2.72%"); zero reads `0%` and a non-zero rate that rounds to zero
  `<0.01%`. A rate always carries its type, "APY" or "APR" (yield-summary's
  `getYieldFigures`, over its `formatRewardRateLabel`), and never
  a period it averages over: the API does not state one.
- ratios such as a price per share: six significant digits, never fewer
  than four ("1.06275", "1.500") (`formatRatio`).
- negative figures use the minus sign `−` (U+2212); a figure that moves reads
  `before → after`; an unknown or unavailable figure reads `—`
  (`unavailableFigure`).

Charts receive their axes as ticks with labels (`TimeSeriesChart`'s
`valueAxis` and `timeAxis`), built by the same module:

- the value axis steps by 1, 2, 2.5 or 5 × 10ⁿ in four or five ticks
  (`getValueAxisTicks`). Its labels share one decimal count; ticks from 1,000
  read in the largest tick's compact unit and ticks under 1,000 in full, and
  zero reads `$0`, `0%` or `0` ("$500 / $1.0K / $1.5K") (`formatUsdAxis`,
  `formatPercentAxis`, `formatAmountAxis` for token units).
- the time axis spans the selected range up to now, even where the series
  starts late or ends early; a series that ends early says so in the chart's
  `caption` ("Data to Sep 16"). Its labels read by day ("Aug 8") and, past six
  months, by month and year ("Dec '24") (`formatTimeAxis`, in
  `src/shared/lib/date.ts`).
- a TVL chart plots the yield's token units, the units of its history; its
  header leads with the USD TVL and the token amount beneath ("$1.98M",
  "≈ 883.29 ETH"), and its latest point reads through the same formatter as
  that token amount.

`AmountInput` keeps the integer part grouped while typing, and refuses text
that reads as another language's decimal separator (`123,45` in English)
rather than regrouping it. Max fills the exact maximum the Feature allows (the
balance, or less where a limit or gas reserve applies), and that exact amount
is what is validated and submitted: display never rounds it, so Max never
submits more than the balance. When the amount does not fit the input even at
the smallest `display` step, the unfocused input shows only the fraction
digits that fit, rounded down but never past the first non-zero digit, so a
non-zero amount never reads 0; focusing shows every digit again. No amount
and a zero amount both show the muted `0` placeholder. Focus edges the panel
that frames the amount in the accent rather than ringing the amount, so the
amount stays bare in its card.

`AmountPanel` has one place for what is wrong with the amount: the start of
the line under it, where `Field` shows its `error` (danger) or, before any
amount is typed, its `warning` (warning tone, not invalid), such as "You need
at least 1 MATIC to stake" for a balance under the minimum. The limits ("Min
1 MATIC") stay the muted helper at the end of that line and never change
tone; a missed limit is said by the error ("Enter at least 1 MATIC"). While
the amount is invalid the panel's edge takes `danger`; focus still edges it
in the accent. A Feature disables Max when there is nothing to fill, and a
Max that fills less than the minimum leaves the error saying so. The Max chip
is a small control's height, and it and the tappable balance grow their hit
area to `hitArea.coarse` under a coarse pointer. What using the amount costs,
such as "Network fee ≈ 0.0003 ETH ($0.52)" or the gas Max keeps aside, goes in
the panel's `notes`: muted caption lines under the panel, outside its card.
Notes never come and go as the amount changes: a Feature holds a note's line
whenever it can apply (the fee line while a wallet is connected and the host
shows gas fees; the Max line while the stake token pays the gas), passes a
null `text` for a caption-sized placeholder while it loads, and states "—"
when there is nothing to estimate.

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
deliberate exception and states its reason after `--`, for example
`// oxlint-disable-next-line design-system/no-raw-design-value -- <why no token fits>`.

## Enforcement

`pnpm lint` and `pnpm check-hygiene` enforce the rules above:

- dependency-cruiser keeps StyleX, Base UI, `motion`, Recharts and TanStack
  Virtual inside `src/ui/` (`design-system-owns-styling-libraries`), and style
  modules (`*.stylex.ts`, `.css`) too (`design-system-owns-style-modules`). It
  keeps other owners on the main interface (`design-system-internals-private`),
  lets only application composition use the composition interface
  (`design-system-composition-importers`), and lets `src/ui/` import only
  itself (`layer-ui`). These run in `check-hygiene`.
- The widget's `design-system` oxlint plugin
  (`packages/widget/scripts/oxlint/design-system-plugin.ts`) rejects lowercase
  JSX elements and `createElement` calls with a lowercase tag
  (`no-html-element-outside-design-system`) and `className` or
  `style`, as attributes or spread
  (`no-class-name-or-style-outside-design-system`), in Features and
  application composition, and, inside `src/ui/` outside the token definitions
  (`src/ui/tokens/`, the theme definitions `src/ui/theme/color-schemes.ts` and
  `src/ui/theme/appearance-presets.ts`) and artwork
  (`src/ui/artwork/`), color literals (`no-color-literal-in-design-system`) and
  raw font sizes, weights, line heights, radii, shadows, z-indices, durations
  and px, rem, em, ch, vw and vh lengths in StyleX definitions
  (`no-raw-design-value`; `1em`, `100vw` and `100vh` stay allowed).
  `widget/no-blanket-disable` fails any oxlint suppression, of these rules or
  any other, that names no rule or gives no reason after `--`.
- oxlint runs StyleX's lint rules (valid styles, unused styles, valid
  shorthands, sorted keys) on `src/ui/` as part of
  `pnpm --filter @stakekit/widget lint`.

Every rule applies to every file; the only exceptions are suppressions that
state their reason.

## Icons

Every icon is drawn in `src/ui/icons/glyphs.tsx` on one 24-unit grid, its
live area about 3 to 21, as open strokes with round caps and joins. `Icon`
sets the stroke in `currentColor` and its width per size (2.25, 1.8, 1.5 and
1.125 grid units at `sm`, `md`, `lg` and `xl`), so every icon draws the same
1.5px line at every size; a glyph never sets its own stroke width. Only status
marks fill: the dot of `InfoIcon`, `HelpIcon` and `WarningIcon` (a 1.25-unit
dot), and the `PreferredIcon` seal with its check knocked out.

- A new icon joins `glyphs` under a `*Icon` name, drawn on the same grid and
  stroke, and the `IconName` union follows. Its doc comment names what it
  stands for when the name alone does not (`ClockIcon`, "a wait or a period").
- `ArrowIcon` points down and takes a `direction`; `ArrowUpIcon` and
  `ArrowDownIcon` are the same arrow for parts that take an icon by name alone
  (`FixedIconName`), such as a `Badge` or an avatar's badge.
- Chevrons (`CaretDownIcon`, `CaretLeftIcon`, `ChevronRightIcon`) disclose or
  lead somewhere; `XIcon` closes or failed; `CheckIcon` is done or chosen.
- The Icon stories `AllIcons` and `EverySize` (and their dark variants) show
  the whole set: a redrawn or new glyph is checked there against its
  neighbours at every size.

## Artwork

Brand artwork (the logo, the Morpho mark) and the generated avatars' palette
live in the Design System as artwork, in `src/ui/artwork/`. They are exempt
from the color-literal rule by location, and their colors never leak into
controls or Color Roles.

Third-party logos (a token's, network's, provider's, validator's or wallet's)
come from the API as plain URLs and are drawn only through the avatars
(`Avatar`, `TokenAvatar`), which frame every logo one way:

- **Logos at full bounds.** A loaded logo draws its own shape, so it shows
  whole (`contain`) on no fill and under no ring: a round one is not clipped,
  so a logo reaching its corners, such as Polygon's, keeps them.
- **Shapes.** Tokens, networks and providers are round; wallets and
  validators take `shape="square"`, a rounded square whose radius steps up
  with the size from the radius roles, so it follows the preset's corners.
  The square's corners are the only part of a loaded logo clipped.
- **Badges.** A token avatar's badge (the network's logo, a `badgeIcon` such
  as an activity's direction, or the success check) sits over the avatar's
  bottom right, inside its footprint, about two fifths of it. It sets itself
  off the logo under it with its own ring, a border in `surface`, the fill of
  the rows and cards avatars sit on (2px; 1px at `xs` and `sm`); the token's
  logo is never cut. A badge's icon scales with the badge. A network logo that
  fails leaves no badge, never an empty disc.
- **Fallbacks.** Without a logo, or once it fails, the avatar draws one or two
  initials of the name it is given (the first letters of its first two words,
  past an address's `0x`; one on `xs` or beside a badge) in a near-black ink
  on a gradient of two neighboring palette hues, picked by a hash of the name
  (`artwork/initials-avatar.ts`), so the same provider always looks the same.
  Callers pass the whole name as `fallback` or `name`, never a clipped or
  pre-cut initial; while a logo loads, the plain `surfaceRaised` disc shows
  instead, so the initials never flash before a logo. The initials and the
  loading disc sit under a 1px inset ring in `border`.
- **Accounts.** An account address gets the generated account avatar: an
  emoji on a palette color, picked by a hash of the address
  (`artwork/account-avatar.ts`), in the same ring.

Story fixtures (`src/ui/storybook/images.ts`) look like real logos in their
own colors (a full-bleed token disc, a square network tile, a provider's logo
on white, a dark mark on a transparent ground, a wallet tile), so the avatar
stories show how each kind is framed in both color schemes.

## Stories

Every primitive, component, variant and pattern has a Storybook story beside
it. Stories run as Chromium tests: an accessibility violation or an unexpected
console error fails them. Play functions cover keyboard operation, the disabled
state, open and close, focus return and selection. A change to a part's
variants, sizes or states updates its stories in the same change.
