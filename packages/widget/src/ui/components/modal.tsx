import { Dialog } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement, ReactNode, RefObject } from "react";
import { useId, useRef, useState } from "react";
import { Text } from "../primitives/text";
import { usePortalContainer } from "../theme/portal-container";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { containerWidth } from "../tokens/size.stylex";
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
  /**
   * Actions under the body, such as a confirm button. They stay in place while
   * the body scrolls, ruled off from it once it overflows.
   */
  readonly footer?: ReactNode;
  /** The element to focus on opening; unset, the first focusable one. */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Renders as the popup's `data-testid`. */
  readonly testId?: string;
  /** Renders as the title's `data-testid`. */
  readonly titleTestId?: string;
  /** Renders as the close button's `data-testid`. */
  readonly closeTestId?: string;
  /**
   * `page` is a full-height dialog, as wide as the split container size, whose
   * body holds a page edge to edge, such as an `EmbeddedPage`.
   */
  readonly size?: "default" | "page";
  /** A back button before the title, such as returning to a previous step. */
  readonly back?: {
    /** The back button's accessible name. */
    readonly label: string;
    readonly onBack: () => void;
    /** Renders as the back button's `data-testid`. */
    readonly testId?: string;
  };
  /** Shown right after the title, such as a `Spinner` while work is pending. */
  readonly titleStatus?: ReactNode;
  /** Renders as the scrolling body's `data-testid`. */
  readonly bodyTestId?: string;
  /**
   * Hides an open modal, without ending it, while another surface shows over
   * it. Focus returns to the original opener only when it finally closes.
   */
  readonly suspended?: boolean;
};

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/** What the keyboard can reach: its own focus moves the scroll with it. */
const focusableSelector = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "iframe",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

type BodyScroll = {
  /** The content overflows the body, so it scrolls. */
  readonly overflows: boolean;
  /**
   * It scrolls with nothing in it to focus, so the body itself takes focus
   * for the keyboard to scroll it.
   */
  readonly needsFocus: boolean;
};

/**
 * A ref callback reporting how an element scrolls. It measures again as the
 * element resizes, as a modal body grows with its content up to the dialog's
 * height cap, and as its content changes, which a capped body does not
 * resize for.
 */
const observeScroll =
  (onChange: (scroll: BodyScroll) => void) => (element: HTMLElement | null) => {
    if (element === null) return;
    const measure = () => {
      const overflows = element.scrollHeight > element.clientHeight;
      onChange({
        overflows,
        needsFocus:
          overflows && element.querySelector(focusableSelector) === null,
      });
    };
    const resizes = new ResizeObserver(measure);
    resizes.observe(element);
    const mutations = new MutationObserver(measure);
    mutations.observe(element, {
      attributeFilter: ["disabled", "href", "tabindex", "contenteditable"],
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      resizes.disconnect();
      mutations.disconnect();
    };
  };

/**
 * A dialog: a bottom sheet below a 520px viewport and a centered dialog from
 * there up. Its height is capped, so a long list scrolls in its body under
 * the title. It traps focus, closes on Escape and returns focus to its
 * opener, also after being `suspended` in between.
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
  initialFocus,
  testId,
  titleTestId,
  closeTestId,
  size = "default",
  back,
  titleStatus,
  bodyTestId,
  suspended = false,
}: ModalProps) => {
  const container = usePortalContainer();
  const opener = useRef<HTMLElement | null>(null);
  const [resuming, setResuming] = useState(false);
  const titleId = useId();
  const [bodyOverflows, setBodyOverflows] = useState(false);
  const [bodyNeedsFocus, setBodyNeedsFocus] = useState(false);
  // Created once, so re-renders keep the body's observers connected.
  const [observeBody] = useState(() =>
    observeScroll(({ overflows, needsFocus }) => {
      setBodyOverflows(overflows);
      setBodyNeedsFocus(needsFocus);
    })
  );
  // A modal shown again after being suspended keeps its original opener.
  if (open === true && suspended && !resuming) setResuming(true);
  if (open !== true && resuming) setResuming(false);

  return (
    <Dialog.Root
      open={open === undefined ? undefined : open && !suspended}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop {...stylex.props(dialogStyles.backdrop)} />
        <Dialog.Popup
          initialFocus={() => {
            if (!resuming || !opener.current?.isConnected) {
              const root = container?.getRootNode() ?? document;
              const active =
                root instanceof ShadowRoot || root instanceof Document
                  ? root.activeElement
                  : document.activeElement;
              opener.current =
                active instanceof HTMLElement && active !== document.body
                  ? active
                  : null;
            }
            return initialFocus?.current ?? true;
          }}
          finalFocus={() => {
            if (suspended) return false;
            return opener.current?.isConnected ? opener.current : true;
          }}
          data-testid={testId}
          {...stylex.props(styles.popup, size === "page" && styles.pagePopup)}
        >
          <div {...stylex.props(styles.header)}>
            {back && (
              <IconButton
                icon="CaretLeftIcon"
                label={back.label}
                onClick={back.onBack}
                {...(back.testId === undefined ? {} : { testId: back.testId })}
              />
            )}
            <div {...stylex.props(styles.title)}>
              <Dialog.Title
                id={titleId}
                data-testid={titleTestId}
                render={<Text variant="title" as="h2" />}
              >
                {title}
              </Dialog.Title>
              {titleStatus}
            </div>
            <Dialog.Close
              render={
                <IconButton
                  icon="XIcon"
                  label={closeLabel}
                  {...(closeTestId === undefined
                    ? {}
                    : { testId: closeTestId })}
                />
              }
            />
          </div>
          <div
            ref={observeBody}
            data-testid={bodyTestId}
            // A body that scrolls with nothing to focus in it takes focus
            // itself, named by the title, so the keyboard can scroll it.
            {...(bodyNeedsFocus
              ? { tabIndex: 0, role: "region", "aria-labelledby": titleId }
              : {})}
            {...stylex.props(
              styles.body,
              footer !== undefined && styles.bodyOverFooter,
              size === "page" && styles.pageBody,
              styles.bodyFocusRing
            )}
          >
            {description !== undefined && (
              <Dialog.Description render={<Text as="p" tone="muted" />}>
                {description}
              </Dialog.Description>
            )}
            {children}
          </div>
          {footer !== undefined && (
            <div
              {...stylex.props(
                styles.footer,
                bodyOverflows && styles.footerUnderScroll
              )}
            >
              {footer}
            </div>
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
  title: {
    gap: space[8],
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    minWidth: 0,
  },
  // Fills the viewport but a scrim's margin, so an embedded page has room,
  // past the cap of a list's dialog; a sheet below 520px.
  pagePopup: {
    height: {
      default: overlaySize.pageSheetHeight,
      [viewport.dialog]: overlaySize.pageDialogHeight,
    },
    maxHeight: "none",
    width: {
      default: "100%",
      [viewport.dialog]: `min(${containerWidth.split}, calc(100vw - 2 * ${overlaySize.dialogInset}))`,
    },
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
  // The focus ring of a body that takes focus, drawn inside it: the body
  // spans the dialog's width, so a ring outside it would pass its edges.
  bodyFocusRing: {
    outlineColor: color.focusRing,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
  // The footer's own top padding parts it from the body, so that space stays
  // put while the body scrolls under it.
  bodyOverFooter: { paddingBottom: 0 },
  pageBody: {
    paddingBlock: 0,
    paddingInline: 0,
    marginTop: space[12],
    overflowY: "hidden",
  },
  footer: {
    gap: space[8],
    paddingInline: space[20],
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    paddingBottom: space[20],
    paddingTop: space[16],
  },
  footerUnderScroll: {
    borderTopColor: color.border,
    borderTopStyle: "solid",
    borderTopWidth: borderWidth.thin,
  },
});
