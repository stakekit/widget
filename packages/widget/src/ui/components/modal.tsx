import { Dialog } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement, ReactNode } from "react";
import { Text } from "../primitives/text";
import { usePortalContainer } from "../theme/portal-container";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { font } from "../tokens/typography.stylex";
import { viewport } from "../tokens/viewport.stylex";
import { dialogStyles } from "./dialog-styles";
import { IconButton } from "./icon-button";

type ModalProps = {
  /** Open state; leave unset with `trigger` to let the trigger open it. */
  readonly open?: boolean;
  /** Called with `false` on Escape, a scrim click and the close button. */
  readonly onOpenChange?: (open: boolean) => void;
  /**
   * The element that opens the modal, such as a `Button`. It must forward its
   * ref and props. Focus returns to it when the modal closes.
   */
  readonly trigger?: ReactElement;
  /** Names the dialog; shown in the title type role. */
  readonly title: string;
  readonly description?: ReactNode;
  /** The close button's accessible name. */
  readonly closeLabel: string;
  readonly children?: ReactNode;
  /** Actions under the body, such as a confirm button. */
  readonly footer?: ReactNode;
};

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/**
 * A dialog: a bottom sheet below a 520px viewport and a centered dialog from
 * there up. It traps focus, closes on Escape and returns focus to its opener.
 */
export const Modal = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel,
  children,
  footer,
}: ModalProps) => {
  const container = usePortalContainer();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop {...stylex.props(dialogStyles.backdrop)} />
        <Dialog.Popup {...stylex.props(styles.popup)}>
          <div {...stylex.props(styles.header)}>
            <Dialog.Title render={<Text variant="title" as="h2" />}>
              {title}
            </Dialog.Title>
            <Dialog.Close
              render={<IconButton icon="XIcon" label={closeLabel} />}
            />
          </div>
          <div {...stylex.props(styles.body)}>
            {description !== undefined && (
              <Dialog.Description render={<Text as="p" tone="muted" />}>
                {description}
              </Dialog.Description>
            )}
            {children}
          </div>
          {footer !== undefined && (
            <div {...stylex.props(styles.footer)}>{footer}</div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const styles = stylex.create({
  // A sheet along the bottom edge; a centered dialog from 520px up.
  popup: {
    borderRadius: { default: 0, [viewport.dialog]: radius.overlay },
    backgroundColor: color.background,
    boxShadow: elevation.overlay,
    boxSizing: "border-box",
    color: color.text,
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    opacity: { default: 1, [enteringOrLeaving]: 0 },
    outlineStyle: "none",
    position: "fixed",
    transitionDuration: motion.base,
    transitionProperty: "opacity, translate",
    transitionTimingFunction: motion.easing,
    translate: {
      default: "0 0",
      [enteringOrLeaving]: `0 ${overlaySize.enterOffset}`,
      [viewport.dialog]: {
        default: "-50% -50%",
        [enteringOrLeaving]: `-50% calc(-50% + ${overlaySize.enterOffset})`,
      },
    },
    zIndex: layer.modal,
    borderTopLeftRadius: radius.overlay,
    borderTopRightRadius: radius.overlay,
    bottom: { default: 0, [viewport.dialog]: "auto" },
    left: { default: 0, [viewport.dialog]: "50%" },
    maxHeight: {
      default: overlaySize.sheetMaxHeight,
      [viewport.dialog]: overlaySize.dialogMaxHeight,
    },
    top: { default: "auto", [viewport.dialog]: "50%" },
    width: {
      default: "100%",
      [viewport.dialog]: `min(${overlaySize.dialogWidth}, calc(100vw - 2 * ${overlaySize.dialogInset}))`,
    },
  },
  header: {
    gap: space[12],
    paddingInline: space[20],
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    justifyContent: "space-between",
    paddingTop: space[20],
  },
  body: {
    gap: space[12],
    paddingBlock: space[16],
    paddingInline: space[20],
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
  },
  footer: {
    gap: space[8],
    paddingInline: space[20],
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    paddingBottom: space[20],
  },
});
