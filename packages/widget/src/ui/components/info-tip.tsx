import { Popover as BasePopover } from "@base-ui/react/popover";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId, useState } from "react";
import { Text } from "../primitives/text";
import { usePortalContainer } from "../theme/portal-container";
import { layer } from "../tokens/layer.stylex";
import { popupOffset } from "../tokens/overlay.stylex";
import { IconButton } from "./icon-button";
import { usePopupBoundary } from "./popup-boundary";
import { popupStyles } from "./popup-styles";

type InfoTipProps = {
  /** Names the info button, such as "About the reward rate". */
  readonly label: string;
  /**
   * The explanation: text, or a short stack of paragraphs that may end in a
   * link to where it comes from, such as a rating's methodology.
   */
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
};

/**
 * An info button that explains what is beside it. Unlike a `Tooltip`, it
 * opens on tap as well as on click and keyboard focus, so touch users can
 * read it. Focus stays on the button, which the explanation describes, and
 * Tab moves on to a link inside it; Escape or a press outside closes it. It
 * stays inside the Widget, or the dialog it opens from, flipping or shifting
 * rather than passing their edge.
 */
export const InfoTip = ({ label, children, side = "top" }: InfoTipProps) => {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const { anchorRef, collisionBoundary } = usePopupBoundary();

  return (
    <BasePopover.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <BasePopover.Trigger
        ref={anchorRef}
        render={
          <IconButton
            icon="InfoIcon"
            label={label}
            size="xs"
            aria-describedby={open ? contentId : undefined}
            // Only keyboard focus opens it. A press focuses without
            // `:focus-visible` and opens it with its click; focus a script
            // moves here after a pointer interaction stays closed.
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) setOpen(true);
            }}
          />
        }
      />
      <BasePopover.Portal container={container}>
        <BasePopover.Positioner
          side={side}
          sideOffset={Number.parseFloat(popupOffset.hint)}
          collisionBoundary={collisionBoundary}
          {...stylex.props(popupStyles.positioner, styles.positioner)}
        >
          <BasePopover.Popup
            aria-label={label}
            initialFocus={false}
            {...stylex.props(popupStyles.surface, popupStyles.panel)}
          >
            <Text as="div" id={contentId}>
              {children}
            </Text>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
};

const styles = stylex.create({
  positioner: { zIndex: layer.tooltip },
});
