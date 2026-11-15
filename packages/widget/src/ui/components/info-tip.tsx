import { Popover as BasePopover } from "@base-ui/react/popover";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId, useRef, useState } from "react";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { usePortalProps } from "../theme/portal-container";
import { layer } from "../tokens/layer.stylex";
import { popupOffset } from "../tokens/overlay.stylex";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { usePopupBoundary } from "./popup-boundary";
import { popupStyles } from "./popup-styles";

/** An action at the end of a tip, such as opening the full details. */
export type InfoTipAction = {
  readonly label: string;
  readonly onClick: () => void;
};

type InfoTipProps = {
  /** Names the info button, such as "About the reward rate". */
  readonly label: string;
  /**
   * The explanation: text, or a short stack of paragraphs that may end in a
   * link to where it comes from, such as a rating's methodology.
   */
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  /** Closes the tip as it runs, so what it opens takes its place. */
  readonly action?: InfoTipAction | undefined;
};

/**
 * An info button that explains what is beside it. Unlike a `Tooltip`, it
 * opens on tap as well as on click and keyboard focus, so touch users can
 * read it. Focus stays on the button, which the explanation describes, and
 * Tab moves on to a link or the action inside it; Escape or a press outside
 * closes it, as does its action. It stays inside the Widget, or the dialog it
 * opens from, flipping or shifting rather than passing their edge.
 */
export const InfoTip = ({
  label,
  children,
  side = "top",
  action,
}: InfoTipProps) => {
  const portalProps = usePortalProps();
  const [open, setOpen] = useState(false);
  // Closing returns focus to the button, but after the action whatever it
  // opened holds focus, so the tip leaves focus where it is.
  const actionClosed = useRef(false);
  const contentId = useId();
  const { anchorRef, collisionBoundary } = usePopupBoundary();

  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) actionClosed.current = false;
        setOpen(next);
      }}
    >
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
      <BasePopover.Portal {...portalProps}>
        <BasePopover.Positioner
          side={side}
          sideOffset={Number.parseFloat(popupOffset.hint)}
          collisionBoundary={collisionBoundary}
          {...stylex.props(popupStyles.positioner, styles.positioner)}
        >
          <BasePopover.Popup
            aria-label={label}
            initialFocus={false}
            finalFocus={() => !actionClosed.current}
            {...stylex.props(popupStyles.surface, popupStyles.panel)}
          >
            <Stack gap={8} align="start">
              <Text as="div" id={contentId}>
                {children}
              </Text>
              {action && (
                <BasePopover.Close
                  render={
                    <Button
                      size="sm"
                      variant="link"
                      iconEnd="ChevronRightIcon"
                      onClick={() => {
                        actionClosed.current = true;
                        action.onClick();
                      }}
                    >
                      {action.label}
                    </Button>
                  }
                />
              )}
            </Stack>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
};

const styles = stylex.create({
  positioner: { zIndex: layer.tooltip },
});
