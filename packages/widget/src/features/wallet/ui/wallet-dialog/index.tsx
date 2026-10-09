import { Content, Overlay, Portal, Root } from "@radix-ui/react-dialog";
import clsx from "clsx";
import type { PropsWithChildren } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { id } from "../../../../shared/styles/theme/ids";
import { useWidgetPresentation } from "../../../../shared/ui/widget-presentation";
import { CloseIcon, MobileCloseIcon } from "./icons";
import {
  closeButton,
  content,
  desktopClose,
  mobileClose,
  overlay,
  positioner,
} from "./styles.css";

/**
 * Owned wallet dialog. `suspended` hides an open dialog while another wallet
 * surface is presented over it; focus returns to the original opener only when
 * the dialog finally closes.
 */
export const WalletDialog = ({
  children,
  open,
  suspended = false,
  onOpenChange,
  testId,
  className,
}: PropsWithChildren<{
  readonly open: boolean;
  readonly suspended?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly testId: string;
  readonly className?: string;
}>) => {
  const { portalContainer } = useWidgetPresentation();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [resuming, setResuming] = useState(false);
  // A session that was suspended keeps its opener when it is shown again.
  if (open && suspended && !resuming) setResuming(true);
  if (!open && resuming) setResuming(false);
  const mobile =
    typeof navigator !== "undefined" &&
    (/android|iPhone|iPod|iPad/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  return (
    <Root open={open && !suspended} onOpenChange={onOpenChange}>
      <Portal container={portalContainer}>
        <div data-rk={id} data-wallet-dialog-mobile={mobile || undefined}>
          <Overlay className={overlay} />
          <div className={positioner}>
            <Content
              aria-describedby={undefined}
              className={clsx(content, className)}
              data-testid={testId}
              onOpenAutoFocus={() => {
                if (resuming && returnFocus.current?.isConnected) return;
                const root = portalContainer?.getRootNode();
                const active =
                  root instanceof ShadowRoot
                    ? root.activeElement
                    : document.activeElement;
                returnFocus.current =
                  active instanceof HTMLElement ? active : null;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (!suspended) returnFocus.current?.focus();
              }}
            >
              {children}
            </Content>
          </div>
        </div>
      </Portal>
    </Root>
  );
};

export const WalletDialogClose = ({
  onClose,
}: {
  readonly onClose: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={closeButton}
      aria-label={t("wallet_modal.close")}
      onClick={onClose}
    >
      <span className={desktopClose}>
        <CloseIcon />
      </span>
      <span className={mobileClose}>
        <MobileCloseIcon />
      </span>
    </button>
  );
};
