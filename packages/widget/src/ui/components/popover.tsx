import { Popover as BasePopover } from "@base-ui/react/popover";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement, ReactNode } from "react";
import { Text } from "../primitives/text";
import { usePortalContainer } from "../theme/portal-container";
import { layer } from "../tokens/layer.stylex";
import { focusRingStyles } from "./focus-ring";
import { popupStyles } from "./popup-styles";

type PopoverProps = {
  /**
   * The element that opens the popover, such as a `Button`. It must forward
   * its ref and props. Focus returns to it when the popover closes.
   */
  readonly trigger: ReactElement;
  /** Names the popover; shown at its top. */
  readonly title: string;
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  /** Open state; leave unset to let the trigger open it. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

/**
 * A small panel that opens from a trigger on click, tap or Enter, beside the
 * page rather than over it. Escape or a press outside closes it.
 */
export const Popover = ({
  trigger,
  title,
  children,
  side = "bottom",
  open,
  onOpenChange,
}: PopoverProps) => {
  const container = usePortalContainer();

  return (
    <BasePopover.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal container={container}>
        <BasePopover.Positioner
          side={side}
          sideOffset={8}
          {...stylex.props(popupStyles.positioner, styles.positioner)}
        >
          {/* Holding only text, the popup itself takes focus on open, so it
              draws the ring a keyboard user follows there. */}
          <BasePopover.Popup
            {...stylex.props(
              popupStyles.surface,
              popupStyles.panel,
              focusRingStyles.visible
            )}
          >
            <BasePopover.Title render={<Text as="h2" variant="heading" />}>
              {title}
            </BasePopover.Title>
            <BasePopover.Description render={<Text as="div" tone="muted" />}>
              {children}
            </BasePopover.Description>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
};

const styles = stylex.create({
  positioner: { zIndex: layer.dropdown },
});
