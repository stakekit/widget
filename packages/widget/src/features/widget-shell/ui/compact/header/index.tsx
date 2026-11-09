import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Box, Grid, IconButton, Stack } from "../../../../../ui/index";
import { LeaveConfirmationDialog } from "../../../../leave-confirmation/views";
import {
  isMountAnimationFinished,
  useMountAnimation,
  useMountRevealReady,
} from "../../../../mount-animation/index";
import { AccountModal, ChainModal } from "../../../../wallet/views";
import { ShellFrame } from "../../shell-frame";
import { useHeader } from "../../use-header";

/**
 * The Compact Layout's frame: one header row above the page, with the back
 * button at its start, the wallet controls centred and the disconnect button
 * at its end. With none of them to show, such as before a wallet connects
 * on a tab page, the header leaves no band. On mount the frame grows open
 * once the first page can show, and the mount animation's layout step
 * finishes when it is open; a host that disables that animation starts with
 * the step finished. When `pageKey` changes the frame eases to the new
 * page's height; so it does as the mount animation finishes, when the first
 * page's stand-in gives way to the page.
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
  const revealReady = useMountRevealReady();
  // Latched at mount: the reveal that finishes the layout step keeps running.
  const [revealsOnMount] = useState(() => !state.layout);

  const showsWallet =
    !hidesHeaderWalletControl &&
    walletConfigReady &&
    (isConnected || isConnecting);
  // The wallet controls stay centred in the frame whatever the flanks hold.
  const header =
    showBack || showsWallet || showDisconnect ? (
      <Grid hostHook="header" columns="flanked" align="center" gap={8}>
        <Stack direction="row" justify="start">
          {showBack && (
            <IconButton
              icon="CaretLeftIcon"
              label={t("shared.back")}
              onClick={onLeftIconPress}
            />
          )}
        </Stack>
        {showsWallet ? (
          <Stack direction="row" align="center" gap={8}>
            {!hideChainSelector && <ChainModal triggerSize="sm" />}
            <AccountModal triggerSize="sm" />
          </Stack>
        ) : (
          <Box />
        )}
        <Stack direction="row" justify="end">
          {showDisconnect && (
            <IconButton
              icon="XIcon"
              label={t("wallet_modal.disconnect")}
              onClick={onXPress}
            />
          )}
        </Stack>
      </Grid>
    ) : undefined;

  return (
    <>
      <ShellFrame
        pageKey={isMountAnimationFinished(state) ? pageKey : mountingPageKey}
        header={header}
        reveal={
          revealsOnMount
            ? {
                ready: revealReady,
                onRevealed: () => dispatch({ type: "layout" }),
              }
            : undefined
        }
      >
        {children}
      </ShellFrame>
      <LeaveConfirmationDialog {...leaveConfirmationDialog} />
    </>
  );
};

/** The frame's page while the mount animation runs, before any route's. */
const mountingPageKey = "mounting";
