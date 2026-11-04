import { Dialog } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement, ReactNode, RefObject } from "react";
import { useRef, useState } from "react";
import { Text } from "../primitives/text";
import { usePortalContainer } from "../theme/portal-container";
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
  /** Actions under the body, such as a confirm button. */
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

/**
 * A dialog: a bottom sheet below a 520px viewport and a centered dialog from
 * there up. It traps focus, closes on Escape and returns focus to its opener,
 * also after being `suspended` in between.
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
            data-testid={bodyTestId}
            {...stylex.props(styles.body, size === "page" && styles.pageBody)}
          >
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
  title: {
    gap: space[8],
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    minWidth: 0,
  },
  // Fills the dialog's height so an embedded page has room; a sheet below 520px.
  pagePopup: {
    height: {
      default: overlaySize.sheetMaxHeight,
      [viewport.dialog]: overlaySize.dialogMaxHeight,
    },
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
  },
});
