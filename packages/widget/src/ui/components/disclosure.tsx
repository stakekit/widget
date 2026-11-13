import { Collapsible } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { Icon } from "../primitives/icon";
import { space } from "../tokens/space.stylex";
import { disclosureStyles } from "./disclosure-styles";
import { focusRingStyles } from "./focus-ring";
import { useReducedMotion } from "./use-reduced-motion";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/**
 * The nearest ancestor that scrolls its overflow, such as a details pane.
 * One that clips it, such as the widget's frame, never scrolls: moving it
 * would shift everything it holds.
 */
const scrollingAncestor = (node: HTMLElement | null): HTMLElement | null => {
  if (!node) return null;
  const { overflowY } = getComputedStyle(node);
  return (overflowY === "auto" || overflowY === "scroll") &&
    node.scrollHeight > node.clientHeight
    ? node
    : scrollingAncestor(node.parentElement);
};

type DisclosureProps = {
  /** The trigger's text; it names the content it shows. */
  readonly title: string;
  readonly children: ReactNode;
  /** Open state; leave unset to let the trigger toggle it. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly defaultOpen?: boolean;
  /** An avatar before the title, such as the provider's logo. */
  readonly leading?: ReactNode;
  /** Badges or a decorative icon after the title, such as a status. */
  readonly badges?: ReactNode;
  /** Renders as the trigger's `data-testid`. */
  readonly testId?: string;
  /**
   * Each new value other than 0 opens the section, scrolls its trigger to
   * the top of the area scrolling it (the page only when it is out of view
   * and nothing else scrolls) and moves focus to it, as when something
   * elsewhere asks to show it. An area that clips without scrolling, such as
   * a frame, never moves.
   */
  readonly revealKey?: number;
};

/**
 * A section that shows or hides its content, such as more details. The
 * trigger is a button whose expanded state says whether it is open; it may
 * lead with an avatar and carry badges after its title.
 */
export const Disclosure = ({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  leading,
  badges,
  testId,
  revealKey,
}: DisclosureProps) => {
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [revealedKey, setRevealedKey] = useState(revealKey);
  // A new reveal opens the section in the same render, not after it.
  if (revealKey !== revealedKey) {
    setRevealedKey(revealKey);
    if (revealKey) setOwnOpen(true);
  }
  const isOpen = open ?? ownOpen;
  const changeOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };

  const reveal = useEffectEvent(() => {
    // A controlling owner opens it through `open`.
    if (open === false) onOpenChange?.(true);
    const element = trigger.current;
    if (!element) return;
    const behavior = reducedMotion ? "auto" : "smooth";
    const { top, bottom } = element.getBoundingClientRect();
    const area = scrollingAncestor(element.parentElement);
    if (area) {
      area.scrollBy({ top: top - area.getBoundingClientRect().top, behavior });
    } else if (top < 0 || bottom > window.innerHeight) {
      // Out of the page's view with nothing else to scroll, the page scrolls.
      window.scrollBy({ top, behavior });
    }
    element.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (revealKey) reveal();
  }, [revealKey]);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={changeOpen}>
      {/* Full width, in a container that may scroll: the ring draws inside. */}
      <Collapsible.Trigger
        ref={trigger}
        data-testid={testId}
        {...stylex.props(
          disclosureStyles.trigger,
          focusRingStyles.visible,
          focusRingStyles.inset
        )}
      >
        {leading === undefined && badges === undefined ? (
          title
        ) : (
          <span {...stylex.props(styles.title)}>
            {leading}
            <span>{title}</span>
            {badges}
          </span>
        )}
        <span {...stylex.props(disclosureStyles.caret)}>
          <Icon name="CaretDownIcon" size="sm" />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel
        {...stylex.props(disclosureStyles.panel, styles.panel)}
      >
        <div {...stylex.props(disclosureStyles.content)}>{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};

const styles = stylex.create({
  title: {
    gap: space[8],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  panel: {
    height: {
      default: "var(--collapsible-panel-height)",
      [enteringOrLeaving]: 0,
    },
  },
});
