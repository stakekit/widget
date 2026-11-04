import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement } from "react";
import { usePortalContainer } from "../theme/portal-container";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

type TooltipProps = {
  /** The hint. Only repeat what the element already says: touch never opens it. */
  readonly label: string;
  /**
   * The element it describes, such as a `Button`. It must forward its ref and
   * props.
   */
  readonly children: ReactElement;
  readonly side?: "top" | "right" | "bottom" | "left";
};

/** A short hint shown on hover and keyboard focus; Escape hides it. */
export const Tooltip = ({ label, children, side = "top" }: TooltipProps) => {
  const container = usePortalContainer();

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal container={container}>
        <BaseTooltip.Positioner
          side={side}
          sideOffset={8}
          {...stylex.props(styles.positioner)}
        >
          <BaseTooltip.Popup {...stylex.props(styles.popup)}>
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
};

const styles = stylex.create({
  positioner: { zIndex: layer.tooltip },
  popup: {
    borderRadius: radius.badge,
    paddingBlock: space[6],
    paddingInline: space[8],
    backgroundColor: color.surfaceRaised,
    boxShadow: elevation.overlay,
    color: color.text,
    fontFamily: font.sans,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.caption,
    opacity: {
      default: 1,
      ":is([data-starting-style], [data-ending-style])": 0,
    },
    transitionDuration: motion.fast,
    transitionProperty: "opacity",
    transitionTimingFunction: motion.easing,
    maxWidth: overlaySize.tooltipMaxWidth,
  },
});
