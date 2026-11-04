import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import * as stylex from "@stylexjs/stylex";
import { accountAvatar } from "../artwork/account-avatar";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { avatarBadgeSize, avatarSize } from "../tokens/size.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

/** An avatar size: `sm` sits in a row of text, `xl` heads an account dialog. */
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
      {props.networkSrc !== undefined && (
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
      )}
    </span>
  );
};

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
  // A provider's logo is a square tile; `badge` matches its small size.
  square: { borderRadius: radius.badge },
  image: {
    display: "block",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  token: {
    display: "inline-flex",
    flexShrink: 0,
    position: "relative",
  },
  badge: {
    borderColor: color.background,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    overflow: "hidden",
    backgroundColor: color.background,
    boxSizing: "content-box",
    display: "flex",
    insetInlineEnd: 0,
    position: "absolute",
    bottom: 0,
  },
  generated: (backgroundColor: string) => ({ backgroundColor }),
});

const sizeStyles = stylex.create({
  xs: { height: avatarSize.xs, width: avatarSize.xs },
  sm: { height: avatarSize.sm, width: avatarSize.sm },
  md: { height: avatarSize.md, width: avatarSize.md },
  lg: { height: avatarSize.lg, width: avatarSize.lg },
  xl: { height: avatarSize.xl, width: avatarSize.xl },
});

const fallbackTextStyles = stylex.create({
  xs: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  sm: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  md: { fontSize: fontSize.label, lineHeight: lineHeight.label },
  lg: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  xl: { fontSize: fontSize.title, lineHeight: lineHeight.title },
});

// The emoji fills about two thirds of the circle.
const emojiStyles = stylex.create({
  xs: { fontSize: fontSize.overline, lineHeight: lineHeight.overline },
  sm: { fontSize: fontSize.heading, lineHeight: lineHeight.heading },
  md: { fontSize: fontSize.title, lineHeight: lineHeight.title },
  lg: { fontSize: fontSize.display, lineHeight: lineHeight.display },
  xl: { fontSize: fontSize.display, lineHeight: lineHeight.display },
});

const badgeSizeStyles = stylex.create({
  xs: { height: avatarBadgeSize.xs, width: avatarBadgeSize.xs },
  sm: { height: avatarBadgeSize.sm, width: avatarBadgeSize.sm },
  md: { height: avatarBadgeSize.md, width: avatarBadgeSize.md },
  lg: { height: avatarBadgeSize.lg, width: avatarBadgeSize.lg },
  xl: { height: avatarBadgeSize.xl, width: avatarBadgeSize.xl },
});
