import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import * as stylex from "@stylexjs/stylex";
import { type ReactElement, useState } from "react";

import { accountAvatar } from "../artwork/account-avatar";
import { initialsAvatar } from "../artwork/initials-avatar";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth, insetEdge } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { keyframes } from "../tokens/keyframes.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { avatarBadgeSize, avatarSize } from "../tokens/size.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

/** An avatar size: `sm` sits in a row of text, `card` leads a card's heading. */
type AvatarSize = keyof typeof sizeStyles;

/**
 * `round` for a token's, a network's or a provider's logo; `square` rounds
 * the corners of a wallet's or a validator's instead.
 */
type AvatarShape = "round" | "square";

type AvatarProps = {
  /** A plain image URL; unset or failing, the fallback's initials show. */
  readonly src?: string | undefined;
  /** Names the avatar, such as a token's or provider's name; unset, it is decorative. */
  readonly label?: string;
  /**
   * The whole name the fallback's initials and gradient come from, such as a
   * provider's name; the label by default. The avatar draws one or two
   * initials of it, never the name itself.
   */
  readonly fallback?: string;
  readonly size?: AvatarSize;
  readonly shape?: AvatarShape;
};

const naming = (label: string | undefined) =>
  label === undefined
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

/**
 * Up to `count` initials of a name: the first letter or digit of each of its
 * first words, past an address's `0x`.
 */
const initials = (name: string, count: number) =>
  name
    .trim()
    .replace(/^0x(?=[\da-f])/iu, "")
    .split(/[\s_/-]+/u)
    .map((word) => /[\p{L}\p{N}]/u.exec(word)?.[0] ?? "")
    .join("")
    .slice(0, count)
    .toUpperCase();

/**
 * The mark every avatar draws. A loaded logo draws its own shape, so it shows
 * whole, on no fill or ring: a round one is not clipped, so a logo reaching
 * its corners, such as Polygon's, keeps them, and a square one only has its
 * corners rounded. Without a logo, or once it fails, the name's initials show
 * on its gradient in a disc under a 1px `border` ring, one initial where a
 * badge or the smallest size leaves no room for two; while a logo loads, the
 * plain raised disc.
 */
const Mark = ({
  src,
  label,
  name,
  size,
  shape,
  badged = false,
}: {
  readonly src: string | undefined;
  readonly label: string | undefined;
  readonly name: string;
  readonly size: AvatarSize;
  readonly shape: AvatarShape;
  readonly badged?: boolean;
}) => {
  const text = initials(name, size === "xs" || badged ? 1 : 2);
  const generated = initialsAvatar(name);

  return (
    <BaseAvatar.Root
      {...naming(label)}
      {...stylex.props(
        styles.mark,
        shape === "square" ? squareStyles[size] : styles.round,
        sizeStyles[size],
        initialsTextStyles[size]
      )}
    >
      {src !== undefined && (
        <BaseAvatar.Image src={src} alt="" {...stylex.props(styles.image)} />
      )}
      <BaseAvatar.Fallback
        aria-hidden="true"
        render={(props, state) =>
          state.imageLoadingStatus === "loading" || text === "" ? (
            <span {...props} />
          ) : (
            <span
              {...props}
              {...stylex.props(
                styles.initials,
                styles.gradient(generated.gradient, generated.ink)
              )}
            >
              {text}
            </span>
          )
        }
      />
    </BaseAvatar.Root>
  );
};

/** An image with its name's initials while it loads or when it fails. */
export const Avatar = ({
  src,
  label,
  fallback,
  size = "md",
  shape = "round",
}: AvatarProps) => (
  <Mark
    src={src}
    label={label}
    name={fallback ?? label ?? ""}
    size={size}
    shape={shape}
  />
);

type TokenAvatarProps = { readonly size?: AvatarSize } & (
  | {
      /** The token's logo URL. */
      readonly src?: string | undefined;
      /** The token's name or symbol: the label and the fallback's initials. */
      readonly name: string;
      /** The network's logo URL, drawn as a badge at the bottom end. */
      readonly networkSrc?: string;
      /**
       * An icon drawn as the badge in place of the network's, such as an
       * activity's direction, on a disc in the text color.
       */
      readonly badgeIcon?: FixedIconName;
      /**
       * Marks a finished action: a success check badge at the bottom end, in
       * place of any other badge, whose check draws in as it mounts.
       */
      readonly success?: boolean;
      /**
       * Hides the avatar from assistive technology, beside text that already
       * names the token, such as a token trigger's symbol.
       */
      readonly decorative?: boolean;
      /** `square` for a wallet's or a validator's logo. */
      readonly shape?: AvatarShape;
      readonly account?: never;
    }
  | {
      /**
       * An account address: draws the generated avatar its address always
       * gets, from the artwork palette.
       */
      readonly account: string;
      /** Names the avatar; unset, it is decorative. */
      readonly label?: string;
      readonly src?: never;
      readonly name?: never;
      readonly networkSrc?: never;
      readonly badgeIcon?: never;
      readonly success?: never;
      readonly decorative?: never;
      readonly shape?: never;
    }
);

/**
 * The badge at a token avatar's bottom end: the success check, else the
 * badge icon, else the network's logo.
 */
const TokenBadge = ({
  size,
  success,
  badgeIcon,
  networkSrc,
  onNetworkError,
}: {
  readonly size: AvatarSize;
  readonly success: boolean;
  readonly badgeIcon: FixedIconName | undefined;
  readonly networkSrc: string | undefined;
  readonly onNetworkError: () => void;
}) => {
  if (success) {
    return (
      <span
        aria-hidden="true"
        {...stylex.props(
          styles.badge,
          styles.successBadge,
          badgeSizeStyles[size]
        )}
      >
        <span {...stylex.props(styles.drawCheck, badgeIconStyles[size])}>
          <Icon name="CheckIcon" size="sm" />
        </span>
      </span>
    );
  }

  if (badgeIcon !== undefined) {
    return (
      <span
        aria-hidden="true"
        {...stylex.props(styles.badge, styles.iconBadge, badgeSizeStyles[size])}
      >
        <span {...stylex.props(styles.badgeIcon, badgeIconStyles[size])}>
          <Icon name={badgeIcon} size="sm" />
        </span>
      </span>
    );
  }

  if (networkSrc === undefined) return null;

  return (
    <BaseAvatar.Root
      aria-hidden="true"
      {...stylex.props(styles.badge, badgeSizeStyles[size])}
    >
      <BaseAvatar.Image
        src={networkSrc}
        alt=""
        onLoadingStatusChange={(status) => {
          if (status === "error") onNetworkError();
        }}
        {...stylex.props(styles.image)}
      />
    </BaseAvatar.Root>
  );
};

/**
 * A token's logo with its network badge, or an account's generated avatar.
 * It takes plain URLs; resolving a token's logo is the caller's job. A
 * network logo that fails leaves no badge, rather than an empty disc.
 */
export const TokenAvatar = (props: TokenAvatarProps) => {
  const size = props.size ?? "md";
  const [failedNetworkSrc, setFailedNetworkSrc] = useState<string>();

  if (props.account !== undefined) {
    const generated = accountAvatar(props.account);

    return (
      <span
        {...naming(props.label)}
        {...stylex.props(
          styles.mark,
          styles.round,
          sizeStyles[size],
          emojiStyles[size],
          styles.generated(generated.color)
        )}
      >
        <span aria-hidden="true">{generated.emoji}</span>
      </span>
    );
  }

  const success = props.success === true;
  const networkSrc =
    props.networkSrc === failedNetworkSrc ? undefined : props.networkSrc;
  const badged =
    success || props.badgeIcon !== undefined || networkSrc !== undefined;

  return (
    <span {...stylex.props(styles.token, sizeStyles[size])}>
      <Mark
        src={props.src}
        label={props.decorative ? undefined : props.name}
        name={props.name}
        size={size}
        shape={props.shape ?? "round"}
        badged={badged}
      />
      <TokenBadge
        size={size}
        success={success}
        badgeIcon={props.badgeIcon}
        networkSrc={networkSrc}
        onNetworkError={() => setFailedNetworkSrc(networkSrc)}
      />
    </span>
  );
};

/**
 * An `Icon` in an avatar's disc, such as the wallet a step waits on. It is
 * decorative: the text beside it names what it shows.
 */
export const IconAvatar = ({
  size = "md",
  children,
}: {
  readonly size?: AvatarSize;
  /** The `Icon`; unset, it draws in the text color. */
  readonly children: ReactElement;
}) => (
  <span
    aria-hidden="true"
    {...stylex.props(styles.mark, styles.round, styles.icon, sizeStyles[size])}
  >
    {children}
  </span>
);

// The fallback's 1px ring is an outline pulled inside the edge, so it holds
// the size. A loaded logo (`:has(> img)`) drops the fill, the ring and, when
// round, the clip, so it shows at its full bounds.
const styles = stylex.create({
  mark: {
    overflow: { default: "hidden", ":has(> img)": "visible" },
    alignItems: "center",
    backgroundColor: {
      default: color.surfaceRaised,
      ":has(> img)": "transparent",
    },
    boxSizing: "border-box",
    color: color.textMuted,
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontWeight: fontWeight.semibold,
    justifyContent: "center",
    outlineColor: color.border,
    outlineOffset: insetEdge.offset,
    outlineStyle: { default: "solid", ":has(> img)": "none" },
    outlineWidth: borderWidth.thin,
    userSelect: "none",
  },
  round: { borderRadius: radius.pill },
  icon: { color: color.text },
  // `contain` fits a logo drawn with its own padding whole, never cropped.
  image: {
    display: "block",
    objectFit: "contain",
    height: "100%",
    width: "100%",
  },
  // The initials fill the disc, so the gradient reaches the mask's edge.
  initials: {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  gradient: (backgroundImage: string, ink: string) => ({
    backgroundImage,
    color: ink,
  }),
  token: {
    display: "inline-flex",
    flexShrink: 0,
    position: "relative",
  },
  // The badge sits over the avatar's bottom right, inside its footprint. Its
  // ring is a border in `surface`, the fill of the rows and cards avatars sit
  // on, counted in its size, so it sets the badge off the logo under it; its
  // fill is the same color, so a transparent network logo reads on it.
  badge: {
    borderColor: color.surface,
    borderRadius: radius.pill,
    borderStyle: "solid",
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: color.surface,
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  iconBadge: { backgroundColor: color.surfaceRaised, color: color.text },
  // A success check on its soft tint, as status colors appear.
  successBadge: {
    backgroundColor: color.successSoft,
    color: color.success,
  },
  badgeIcon: { display: "flex" },
  // The check wipes in from its start, as if drawn, once the badge is in;
  // the motion tokens are zero under reduced motion, so it shows at once.
  drawCheck: {
    animationDelay: motion.base,
    animationDuration: motion.slow,
    animationFillMode: "both",
    animationName: keyframes.drawIn,
    animationTimingFunction: motion.easing,
    display: "flex",
  },
  generated: (backgroundColor: string) => ({ backgroundColor }),
});

const sizeStyles = stylex.create({
  xs: { height: avatarSize.xs, width: avatarSize.xs },
  sm: { height: avatarSize.sm, width: avatarSize.sm },
  control: { height: avatarSize.control, width: avatarSize.control },
  md: { height: avatarSize.md, width: avatarSize.md },
  card: { height: avatarSize.card, width: avatarSize.card },
  lg: { height: avatarSize.lg, width: avatarSize.lg },
  hero: { height: avatarSize.hero, width: avatarSize.hero },
  xl: { height: avatarSize.xl, width: avatarSize.xl },
});

// A rounded square keeps about a quarter of its side as its corner radius,
// from the radius roles, so it follows a preset's corners. A loaded logo
// keeps them too: they are the only part of it clipped.
const squareStyles = stylex.create({
  xs: { borderRadius: radius.badge, overflow: "hidden" },
  sm: { borderRadius: radius.badge, overflow: "hidden" },
  control: { borderRadius: radius.controlInner, overflow: "hidden" },
  md: { borderRadius: radius.controlInner, overflow: "hidden" },
  card: { borderRadius: radius.control, overflow: "hidden" },
  lg: { borderRadius: radius.control, overflow: "hidden" },
  hero: { borderRadius: radius.card, overflow: "hidden" },
  xl: { borderRadius: radius.overlay, overflow: "hidden" },
});

const initialsTextStyles = stylex.create({
  xs: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  sm: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  control: { fontSize: fontSize.caption, lineHeight: lineHeight.caption },
  md: { fontSize: fontSize.label, lineHeight: lineHeight.label },
  card: { fontSize: fontSize.body, lineHeight: lineHeight.body },
  lg: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  hero: { fontSize: fontSize.title, lineHeight: lineHeight.title },
  xl: { fontSize: fontSize.display, lineHeight: lineHeight.display },
});

// The emoji fills about two thirds of the circle.
const emojiStyles = stylex.create({
  xs: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  sm: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  control: { fontSize: fontSize.title, lineHeight: lineHeight.title },
  md: { fontSize: fontSize.title, lineHeight: lineHeight.title },
  card: { fontSize: fontSize.display, lineHeight: lineHeight.display },
  lg: { fontSize: fontSize.display, lineHeight: lineHeight.display },
  hero: { fontSize: fontSize.display, lineHeight: lineHeight.display },
  xl: { fontSize: fontSize.display, lineHeight: lineHeight.display },
});

// The badge's ring is 2px, 1px on the smallest avatars, where 2px would
// leave too little of the network's logo.
const badgeSizeStyles = stylex.create({
  xs: {
    borderWidth: borderWidth.thin,
    height: avatarBadgeSize.xs,
    width: avatarBadgeSize.xs,
  },
  sm: {
    borderWidth: borderWidth.thin,
    height: avatarBadgeSize.sm,
    width: avatarBadgeSize.sm,
  },
  control: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.control,
    width: avatarBadgeSize.control,
  },
  md: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.md,
    width: avatarBadgeSize.md,
  },
  card: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.card,
    width: avatarBadgeSize.card,
  },
  lg: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.lg,
    width: avatarBadgeSize.lg,
  },
  hero: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.hero,
    width: avatarBadgeSize.hero,
  },
  xl: {
    borderWidth: borderWidth.thick,
    height: avatarBadgeSize.xl,
    width: avatarBadgeSize.xl,
  },
});

// A badge's 16px icon scaled to about 80% of the badge, so its stroke thins
// with the badge.
const badgeIconStyles = stylex.create({
  xs: { scale: 0.35 },
  sm: { scale: 0.5 },
  control: { scale: 0.6 },
  md: { scale: 0.7 },
  card: { scale: 0.8 },
  lg: { scale: 1 },
  hero: { scale: 1.1 },
  xl: { scale: 1.6 },
});
