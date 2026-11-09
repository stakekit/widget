import { createContext, type ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";

import { WidgetFrame } from "../../../ui/index";

/**
 * How wide the shell's frame grows: `narrow` for a single column, `wide` for
 * a frame that lays out a split view. Application composition sets it per
 * Layout through the app container.
 */
export type ShellFrameWidth = "narrow" | "wide";

export const ShellFrameWidthContext = createContext<ShellFrameWidth>("narrow");

/** The Widget's frame at the app container's width, with the brand footer. */
export const ShellFrame = ({
  header,
  children,
  pageKey,
  reveal,
}: {
  readonly header?: ReactNode;
  readonly children: ReactNode;
  /** Names the page shown; when it changes the frame eases to its height. */
  readonly pageKey?: string | undefined;
  readonly reveal?:
    | {
        readonly ready: boolean;
        readonly onRevealed?: () => void;
      }
    | undefined;
}) => {
  const { t } = useTranslation();
  const width = useContext(ShellFrameWidthContext);

  return (
    <WidgetFrame
      hostHook="widget-container"
      width={width}
      poweredByLabel={t("shared.powered_by_label")}
      brandName={t("shared.stake_kit")}
      pageKey={pageKey}
      header={header}
      reveal={reveal}
    >
      {children}
    </WidgetFrame>
  );
};
