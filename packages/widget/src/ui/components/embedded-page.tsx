import * as stylex from "@stylexjs/stylex";
/**
 * Another site's page embedded in a frame that fills its parent, such as a
 * verification provider's page in a `page` Modal.
 */
export const EmbeddedPage = ({
  src,
  title,
  testId,
}: {
  readonly src: string;
  /** Names the frame for assistive technology. */
  readonly title: string;
  /** Rendered as `data-testid`. */
  readonly testId?: string;
}) => (
  <iframe
    data-testid={testId}
    referrerPolicy="strict-origin-when-cross-origin"
    src={src}
    title={title}
    {...stylex.props(styles.root)}
  />
);

const styles = stylex.create({
  root: {
    borderStyle: "none",
    display: "block",
    flexGrow: 1,
    minHeight: 0,
    width: "100%",
  },
});
