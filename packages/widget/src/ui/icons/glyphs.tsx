/**
 * The SVG markup of every icon the Widget renders. Only the Design System
 * holds SVG icon markup; brand artwork lives in `../artwork/`.
 *
 * Every glyph is drawn on one 24-unit grid (`glyphViewBox`), its live area
 * about 3 to 21, as open strokes with round caps and joins. `Icon` sets the
 * stroke in `currentColor` and its width, so every icon draws the same 1.5px
 * line at every size. Only status marks fill: the dot of an info, help or
 * warning mark, and the Preferred seal.
 */
import type { ReactNode } from "react";

/** The grid every glyph is drawn on. */
export const glyphViewBox = "0 0 24 24";

/** A filled dot, such as the point of an exclamation mark. */
const dot = (cx: number, cy: number) => (
  <circle cx={cx} cy={cy} r={1.25} fill="currentColor" stroke="none" />
);

/** The ring that frames a round status mark. */
const ring = <circle cx={12} cy={12} r={9} />;

const arrowDown = <path d="M12 4.5v15M18.5 13 12 19.5 5.5 13" />;

export const glyphs = {
  /** Points down; `direction` turns it. */
  ArrowIcon: arrowDown,
  ArrowDownIcon: arrowDown,
  ArrowUpIcon: <path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5" />,
  /** Two opposed arrows, such as for a swap. */
  ArrowsLeftRightIcon: (
    <path d="M20 7.5H4M8 3.5l-4 4 4 4M4 16.5h16M16 12.5l4 4-4 4" />
  ),
  CaretDownIcon: <path d="m6 9 6 6 6-6" />,
  CaretLeftIcon: <path d="m15 18-6-6 6-6" />,
  /** Points to what opens next, such as a row that leads to a page. */
  ChevronRightIcon: <path d="m9 18 6-6-6-6" />,
  /** A status mark: done. */
  CheckCircleIcon: (
    <>
      {ring}
      <path d="m8.25 12.25 2.5 2.5 5-5.25" />
    </>
  ),
  CheckIcon: <path d="m4.5 12.75 4.75 4.75L19.5 6.5" />,
  /** A clock face, such as for a wait or a period. */
  ClockIcon: (
    <>
      {ring}
      <path d="M12 7v5l3.25 2" />
    </>
  ),
  CopyIcon: (
    <>
      <rect x={8.5} y={8.5} width={12} height={12} rx={2} />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  /** An arrow leaving a door, such as for disconnecting a wallet. */
  DisconnectIcon: (
    <path d="M14 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.5M9.5 12h11M17 8.5l3.5 3.5-3.5 3.5" />
  ),
  ExternalLinkIcon: (
    <path d="M14 4h6v6M20 4l-9 9M17.5 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h4.5" />
  ),
  GiftIcon: (
    <>
      <rect x={3.5} y={8} width={17} height={4} rx={1} />
      <path d="M12 8v12.5M19 12v6.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V12M7.75 8a2.25 2.25 0 0 1 0-4.5C10.5 3.5 12 8 12 8s1.5-4.5 4.25-4.5a2.25 2.25 0 0 1 0 4.5" />
    </>
  ),
  /** The globe, such as for a region or a network. */
  GlobeIcon: (
    <>
      {ring}
      <path d="M3 12h18M12 3c2.4 2.55 3.6 5.55 3.6 9s-1.2 6.45-3.6 9c-2.4-2.55-3.6-5.55-3.6-9S9.6 5.55 12 3Z" />
    </>
  ),
  /** A status mark: a question. */
  HelpIcon: (
    <>
      {ring}
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.33c-.53.21-.9.72-.9 1.29v.13" />
      {dot(12, 16.75)}
    </>
  ),
  /** A clock turning back, such as for past activity. */
  HistoryIcon: (
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
  ),
  /** A status mark: information. */
  InfoIcon: (
    <>
      {ring}
      <path d="M12 11.25v5.25" />
      {dot(12, 7.75)}
    </>
  ),
  /** Stacked layers, such as for a list of positions. */
  LayersIcon: (
    <path d="m12 3 9 4.875-9 4.875-9-4.875L12 3ZM3 12l9 4.875L21 12M3 16.125 12 21l9-4.875" />
  ),
  /** A padlock, such as for a locked or protected amount. */
  LockIcon: (
    <>
      <rect x={4.5} y={10.5} width={15} height={10} rx={2} />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5v2" />
    </>
  ),
  MinusIcon: <path d="M5 12h14" />,
  /** A pen, such as for signing a message. */
  PenIcon: (
    <path d="M12 20h9M16.376 3.622a2.12 2.12 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854L16.376 3.622Z" />
  ),
  PlusIcon: <path d="M12 5v14M5 12h14" />,
  /** A status mark: a filled seal around a check, for what is preferred. */
  PreferredIcon: (
    <path
      d="M19.863 9.976c-.302-.316-.617-.643-.734-.93-.109-.262-.116-.698-.122-1.12-.013-.784-.026-1.673-.643-2.291-.617-.617-1.507-.63-2.291-.643-.422-.006-.858-.013-1.12-.122-.287-.118-.613-.432-.93-.734C13.47 3.603 12.84 3 12 3c-.838 0-1.468.604-2.024 1.137-.316.302-.643.617-.93.734-.261.109-.698.116-1.12.122-.784.013-1.673.026-2.291.643-.617.617-.626 1.507-.643 2.291-.006.422-.013.858-.122 1.12-.118.287-.432.613-.734.93C3.603 10.53 3 11.16 3 12c0 .838.604 1.468 1.137 2.024.302.316.617.643.734.93.109.262.116.698.122 1.12.013.784.026 1.673.643 2.291.617.617 1.507.63 2.291.643.422.006.858.013 1.12.122.287.118.613.432.93.734.554.534 1.184 1.137 2.024 1.137.838 0 1.468-.604 2.024-1.137.316-.302.643-.617.93-.734.262-.109.698-.116 1.12-.122.784-.013 1.673-.026 2.291-.643.617-.617.63-1.507.643-2.291.006-.422.013-.858.122-1.12.118-.287.432-.613.734-.93C20.397 13.47 21 12.84 21 12c0-.838-.604-1.468-1.137-2.024Zm-4.194.55-4.5 4.5a.645.645 0 0 1-.91 0l-1.929-1.929a.643.643 0 1 1 .91-.91L10.714 13.662l4.045-4.046a.644.644 0 0 1 .91.91Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  SearchIcon: (
    <>
      <circle cx={10.5} cy={10.5} r={6.75} />
      <path d="m20 20-4.75-4.75" />
    </>
  ),
  /** A shield, such as for risk or protection. */
  ShieldIcon: (
    <path d="M12 3.5 5 6v5.5c0 4.25 2.9 7.6 7 9 4.1-1.4 7-4.75 7-9V6l-7-2.5Z" />
  ),
  /** A wallet, such as for a step waiting for the wallet's signature. */
  WalletIcon: (
    <>
      <path d="M17 7.5v-2a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2M4 6.5a2 2 0 0 0 2 2h13a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2v-11Z" />
      {dot(16, 14)}
    </>
  ),
  /** A status mark: a warning. */
  WarningIcon: (
    <>
      <path d="M10.27 4.5a2 2 0 0 1 3.46 0l7.36 12.75a2 2 0 0 1-1.73 3H4.64a2 2 0 0 1-1.73-3L10.27 4.5Z" />
      <path d="M12 9.5v4" />
      {dot(12, 16.75)}
    </>
  ),
  /** A wrench, such as for maintenance. */
  WrenchIcon: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z" />
  ),
  XIcon: <path d="M18 6 6 18M6 6l12 12" />,
} satisfies Record<`${string}Icon`, ReactNode>;

/** Every icon the Design System draws. */
export type IconName = keyof typeof glyphs;

/**
 * An icon drawn one way only: every icon but `ArrowIcon`, which needs a
 * direction. Parts that show an icon by name alone take these.
 */
export type FixedIconName = Exclude<IconName, "ArrowIcon">;
