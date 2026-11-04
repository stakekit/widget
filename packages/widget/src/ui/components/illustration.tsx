import * as stylex from "@stylexjs/stylex";
import { illustrationSize } from "../tokens/size.stylex";

type IllustrationProps = {
  /** The image URL. */
  readonly src: string;
  /** `md` (240) beside a message, `lg` (320) heading a dialog. */
  readonly size?: "md" | "lg";
  /**
   * Names the picture when it carries information; unset, the illustration is
   * decorative and hidden from assistive technology.
   */
  readonly label?: string;
};

/**
 * A square picture that illustrates a message, such as a help or error
 * dialog's artwork. It shrinks to fit a narrower container.
 */
export const Illustration = ({
  src,
  size = "lg",
  label,
}: IllustrationProps) => (
  // biome-ignore lint/performance/noImgElement: the Widget is not a Next.js app; a plain image is the only way to draw one.
  <img
    src={src}
    alt={label ?? ""}
    {...stylex.props(styles.root, sizeStyles[size])}
  />
);

const styles = stylex.create({
  root: {
    aspectRatio: "1",
    display: "block",
    objectFit: "contain",
    maxWidth: "100%",
  },
});

const sizeStyles = stylex.create({
  md: { height: "auto", width: illustrationSize.md },
  lg: { height: "auto", width: illustrationSize.lg },
});
