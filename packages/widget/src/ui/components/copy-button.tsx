import { VisuallyHidden } from "../primitives/visually-hidden";
import { IconButton } from "./icon-button";
import { useCopy } from "./use-copy";

/**
 * An icon button that copies `value` to the clipboard, shows a check for a
 * moment and announces `copiedLabel`.
 */
export const CopyButton = ({
  value,
  label,
  copiedLabel,
  size = "xs",
}: {
  /** What is copied, in full. */
  readonly value: string;
  /** The button's accessible name, such as "Copy address". */
  readonly label: string;
  /** Announced once copied, such as "Copied". */
  readonly copiedLabel: string;
  readonly size?: "xs" | "sm";
}) => {
  const { copied, copy, announcement } = useCopy();

  return (
    <>
      <IconButton
        icon={copied ? "CheckIcon" : "CopyIcon"}
        label={label}
        size={size}
        onClick={() => copy(value)}
      />
      <VisuallyHidden role="status">{announcement(copiedLabel)}</VisuallyHidden>
    </>
  );
};
