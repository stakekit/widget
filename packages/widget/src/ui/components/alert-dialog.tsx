import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
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
import { Button } from "./button";
import { dialogStyles } from "./dialog-styles";

type AlertDialogProps = {
  /** Open state; leave unset with `trigger` to let the trigger open it. */
  readonly open?: boolean;
  /** Called with `false` on Escape, cancel and confirm. */
  readonly onOpenChange?: (open: boolean) => void;
  /**
   * The element that opens the dialog, such as a `Button`. It must forward
   * its ref and props. Focus returns to it when the dialog closes.
   */
  readonly trigger?: ReactElement;
  /** The question; names the dialog. */
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /** Runs before the dialog closes. */
  readonly onConfirm: () => void;
  /** `danger` for a confirm that loses something, such as leaving a flow. */
  readonly tone?: "primary" | "danger";
};

/**
 * A dialog that asks the user to confirm one decision, such as leaving a
 * flow. It traps focus, starting on cancel; a press outside does not close
 * it, Escape and cancel do, and focus returns to its opener.
 */
export const AlertDialog = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "primary",
}: AlertDialogProps) => {
  const container = usePortalContainer();

  return (
    <BaseAlertDialog.Root
      open={open}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
      {trigger && <BaseAlertDialog.Trigger render={trigger} />}
      <BaseAlertDialog.Portal container={container}>
        <BaseAlertDialog.Backdrop {...stylex.props(dialogStyles.backdrop)} />
        <BaseAlertDialog.Popup {...stylex.props(styles.popup)}>
          <BaseAlertDialog.Title render={<Text variant="title" as="h2" />}>
            {title}
          </BaseAlertDialog.Title>
          <BaseAlertDialog.Description render={<Text as="p" tone="muted" />}>
            {description}
          </BaseAlertDialog.Description>
          <div {...stylex.props(styles.actions)}>
            <BaseAlertDialog.Close render={<Button variant="secondary" />}>
              {cancelLabel}
            </BaseAlertDialog.Close>
            <BaseAlertDialog.Close
              render={<Button variant={tone} onClick={onConfirm} />}
            >
              {confirmLabel}
            </BaseAlertDialog.Close>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
};

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

const styles = stylex.create({
  popup: {
    padding: space[24],
    borderRadius: radius.overlay,
    gap: space[12],
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
    scale: { default: 1, [enteringOrLeaving]: 0.96 },
    transitionDuration: motion.base,
    transitionProperty: "opacity, scale",
    transitionTimingFunction: motion.easing,
    translate: "-50% -50%",
    zIndex: layer.modal,
    left: "50%",
    top: "50%",
    width: `min(${overlaySize.alertDialogWidth}, calc(100vw - 2 * ${overlaySize.dialogInset}))`,
  },
  actions: {
    gap: space[8],
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    marginTop: space[8],
  },
});
