import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Grid, IconButton, Stack } from "../../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../../leave-confirmation/views";
import {
  isMountAnimationFinished,
  useMountAnimation,
  useMountRevealReady,
} from "../../../../mount-animation/index";
import { AccountModal, ChainModal } from "../../../../wallet/views";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { useHeader } from "../../../react/use-header";
import { ShellFrame } from "../../shell-frame";

/**
 * The Compact Layout's frame: the back and disconnect buttons and the wallet
 * controls above the page. The wallet row keeps its height while no wallet
 * is connected, so the tabs stay put when one connects. On mount the
 * frame grows open once the first page can show, unless the host disables
 * that animation; either way the mount animation's layout step finishes when
 * the frame is open. When `pageKey` changes the frame eases to the new page's
 * height; so it does as the mount animation finishes, when the first page's
 * stand-in gives way to the page.
 */
export const CompactFrame = ({
  pageKey,
  children,
}: {
  readonly pageKey: string;
  readonly children: ReactNode;
}) => {
  const { t } = useTranslation();
  const {
    walletConfigReady,
    hidesHeaderWalletControl,
    hideChainSelector,
    isConnected,
    isConnecting,
    showBack,
    onLeftIconPress,
    showDisconnect,
    onXPress,
    leaveConfirmationDialog,
  } = useHeader();
  const { state, dispatch } = useMountAnimation();
  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );
  const revealReady = useMountRevealReady();
  const [revealsOnMount] = useState(
    () => !state.layout && !disableInitLayoutAnimation
  );

  useEffect(() => {
    if (!revealsOnMount) dispatch({ type: "layout" });
  }, [revealsOnMount, dispatch]);

  const showsWalletRow = !hidesHeaderWalletControl;
  const showsWallet =
    showsWalletRow && walletConfigReady && (isConnected || isConnecting);
  const disconnect = showDisconnect && (
    <IconButton
      icon="XIcon"
      label={t("wallet_modal.disconnect")}
      onClick={onXPress}
    />
  );
  // The disconnect button ends the wallet controls' row when there is one,
  // so it takes no row of its own.
  const showsButtonRow = showBack || (showDisconnect && !showsWalletRow);
  const header =
    showsButtonRow || showsWalletRow ? (
      <Stack hostHook="header" gap={8}>
        {showsButtonRow && (
          <Stack
            direction="row"
            align="center"
            justify={showBack ? "between" : "end"}
          >
            {showBack && (
              <IconButton
                icon="CaretLeftIcon"
                label={t("shared.back")}
                onClick={onLeftIconPress}
              />
            )}
            {!showsWalletRow && disconnect}
          </Stack>
        )}
        {showsWalletRow && (
          // The controls stay centred in the frame whether or not the
          // disconnect button ends the row.
          <Grid columns="flanked" align="center" gap={8}>
            <Box />
            <Box minHeight="controlSm">
              {showsWallet && (
                <Stack direction="row" align="center" gap={8}>
                  {!hideChainSelector && <ChainModal triggerSize="sm" />}
                  <AccountModal triggerSize="sm" />
                </Stack>
              )}
            </Box>
            <Stack direction="row" justify="end">
              {disconnect}
            </Stack>
          </Grid>
        )}
      </Stack>
    ) : undefined;

  return (
    <>
      <ShellFrame
        pageKey={isMountAnimationFinished(state) ? pageKey : mountingPageKey}
        {...(header === undefined ? {} : { header })}
        {...(revealsOnMount
          ? {
              reveal: {
                ready: revealReady,
                onRevealed: () => dispatch({ type: "layout" }),
              },
            }
          : {})}
      >
        {children}
      </ShellFrame>
      <LeaveConfirmationDialog {...leaveConfirmationDialog} />
    </>
  );
};

/** The frame's page while the mount animation runs, before any route's. */
const mountingPageKey = "mounting";
