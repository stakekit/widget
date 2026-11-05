import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement } from "react";
import { accountAvatar } from "../artwork/account-avatar";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
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

type AvatarProps = {
  /** A plain image URL; unset or failing, the fallback text shows. */
  readonly src?: string | undefined;
  /** Names the avatar, such as a token's or provider's name; unset, it is decorative. */
  readonly label?: string;
  /** Shown when there is no image; the label's first character by default. */
  readonly fallback?: string;
  readonly size?: AvatarSize;
  /** `square` softens the corners instead, for a provider's or app's logo. */
  readonly shape?: AvatarShape;
};

type AvatarShape = "round" | "square";

const initial = (text: string | undefined) =>
  Array.from(text?.trim() ?? "")[0]?.toUpperCase() ?? "";

const naming = (label: string | undefined) =>
  label === undefined
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

/** An image with fallback text while it loads or when it fails. */
export const Avatar = ({
  src,
  label,
  fallback,
  size = "md",
  shape = "round",
}: AvatarProps) => (
  <BaseAvatar.Root
    {...naming(label)}
    {...stylex.props(
      styles.root,
      shape === "square" && styles.square,
      sizeStyles[size],
      fallbackTextStyles[size]
    )}
  >
    {src !== undefined && (
      <BaseAvatar.Image src={src} alt="" {...stylex.props(styles.image)} />
    )}
    <BaseAvatar.Fallback aria-hidden="true">
      {fallback ?? initial(label)}
    </BaseAvatar.Fallback>
  </BaseAvatar.Root>
);

type TokenAvatarProps = { readonly size?: AvatarSize } & (
  | {
      /** The token's logo URL. */
      readonly src?: string;
      /** The token's name or symbol: the label and the fallback's initial. */
      readonly name: string;
      /** The network's logo URL, drawn as a badge at the bottom end. */
      readonly networkSrc?: string;
      /**
       * Marks a finished action: a success check badge at the bottom end, in
       * place of the network's, whose check draws in as it mounts.
       */
      readonly success?: boolean;
      /**
       * Hides the avatar from assistive technology, beside text that already
       * names the token, such as a token trigger's symbol.
       */
      readonly decorative?: boolean;
      /** `square` for a logo that is not a token's, such as a provider's. */
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
      readonly success?: never;
      readonly decorative?: never;
      readonly shape?: never;
    }
);

/**
 * A token's logo with its network badge, or an account's generated avatar.
 * It takes plain URLs; resolving a token's logo is the caller's job.
 */
export const TokenAvatar = (props: TokenAvatarProps) => {
  const size = props.size ?? "md";

  if (props.account !== undefined) {
    const generated = accountAvatar(props.account);

    return (
      <span
        {...naming(props.label)}
        {...stylex.props(
          styles.root,
          sizeStyles[size],
          emojiStyles[size],
          styles.generated(generated.color)
        )}
      >
        <span aria-hidden="true">{generated.emoji}</span>
      </span>
    );
  }

  return (
    <span {...stylex.props(styles.token, sizeStyles[size])}>
      <Avatar
        src={props.src}
        {...(props.decorative
          ? { fallback: initial(props.name) }
          : { label: props.name })}
        size={size}
        {...(props.shape === undefined ? {} : { shape: props.shape })}
      />
      {props.success === true ? (
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.badge,
            styles.successBadge,
            badgeSizeStyles[size]
          )}
        >
          <span {...stylex.props(styles.drawCheck)}>
            <Icon name="CheckIcon" size="sm" />
          </span>
        </span>
      ) : (
        props.networkSrc !== undefined && (
          <BaseAvatar.Root
            aria-hidden="true"
            {...stylex.props(styles.badge, badgeSizeStyles[size])}
          >
            <BaseAvatar.Image
              src={props.networkSrc}
              alt=""
              {...stylex.props(styles.image)}
            />
          </BaseAvatar.Root>
        )
      )}
    </span>
  );
};

/**
 * An `Icon` in an avatar's circle, such as the direction of an activity in a
 * row. It is decorative: the text beside it names what it shows.
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
    {...stylex.props(styles.root, styles.icon, sizeStyles[size])}
  >
    {children}
  </span>
);

const styles = stylex.create({
  root: {
    borderRadius: radius.pill,
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: color.surface,
    boxSizing: "border-box",
    color: color.textMuted,
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontWeight: fontWeight.semibold,
    justifyContent: "center",
    userSelect: "none",
  },
  // An icon sits on the canvas color, so it reads on a row's surface.
  icon: { backgroundColor: color.background, color: color.text },
  // A provider's logo is a square tile; `badge` matches its small size.
  square: { borderRadius: radius.badge },
  // `contain` fits a logo drawn with its own padding whole, never cropped.
  image: {
    display: "block",
    objectFit: "contain",
    height: "100%",
    width: "100%",
  },
  token: {
    display: "inline-flex",
    flexShrink: 0,
    position: "relative",
  },
  // The ring counts toward the badge's size, so the badge, anchored at the
  // bottom end, stays inside the avatar's footprint.
  badge: {
    borderColor: color.background,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    overflow: "hidden",
    backgroundColor: color.background,
    boxSizing: "border-box",
    display: "flex",
    insetInlineEnd: 0,
    position: "absolute",
    bottom: 0,
  },
  // The success color under a check in the canvas color, which reads on it
  // in either scheme; the badge's ring sets it off the avatar.
  successBadge: {
    alignItems: "center",
    backgroundColor: color.success,
    color: color.background,
    justifyContent: "center",
  },
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

const fallbackTextStyles = stylex.create({
  xs: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  sm: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  control: { fontSize: fontSize.label, lineHeight: lineHeight.label },
  md: { fontSize: fontSize.label, lineHeight: lineHeight.label },
  card: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  lg: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  hero: { fontSize: fontSize.title, lineHeight: lineHeight.title },
  xl: { fontSize: fontSize.title, lineHeight: lineHeight.title },
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

const badgeSizeStyles = stylex.create({
  xs: { height: avatarBadgeSize.xs, width: avatarBadgeSize.xs },
  sm: { height: avatarBadgeSize.sm, width: avatarBadgeSize.sm },
  control: { height: avatarBadgeSize.control, width: avatarBadgeSize.control },
  md: { height: avatarBadgeSize.md, width: avatarBadgeSize.md },
  card: { height: avatarBadgeSize.card, width: avatarBadgeSize.card },
  lg: { height: avatarBadgeSize.lg, width: avatarBadgeSize.lg },
  hero: { height: avatarBadgeSize.hero, width: avatarBadgeSize.hero },
  xl: { height: avatarBadgeSize.xl, width: avatarBadgeSize.xl },
});
