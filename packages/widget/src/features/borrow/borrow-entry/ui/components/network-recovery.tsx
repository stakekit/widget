import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Chain } from "../../../../../services/wallet/wallet-descriptors";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  useScopedWalletChainSelection,
  WalletChainSelectionScope,
  walletChainSelectionAtom,
} from "../../../../wallet/index";
import { ConnectButton, WalletChainPicker } from "../../../../wallet/views";
import { PageCtaButton } from "../../../../widget-shell/views";
import { BorrowNotice } from "../../../action-feedback/views";
import type { BorrowNetworkRecovery } from "../../../wallet/index";

export const BorrowNetworkRecoveryPanel = ({
  recovery,
}: {
  readonly recovery: BorrowNetworkRecovery;
}) => {
  const { t } = useTranslation();

  if (recovery._tag === "SwitchChain") {
    // Leaving the notice interrupts a switch its command started.
    return (
      <WalletChainSelectionScope>
        <BorrowNetworkSwitch chains={recovery.chains} />
      </WalletChainSelectionScope>
    );
  }

  if (recovery._tag === "SwitchManually") {
    return (
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.switch_network_manually", {
          networks: recovery.chains.map((chain) => chain.name).join(", "),
        })}
      </BorrowNotice>
    );
  }

  if (recovery._tag === "Unavailable") {
    return (
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.network_unavailable")}
      </BorrowNotice>
    );
  }

  return (
    <>
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.unsupported_network_description")}
      </BorrowNotice>

      <BorrowConnectCta />
    </>
  );
};

/** Connect CTA docked at the panel bottom, like the page's other CTAs. */
export const BorrowConnectCta = () => (
  <Box marginTop="auto">
    <ConnectButton
      variant={{
        animation: "press",
        color: "primary",
        size: "compact",
      }}
    />
  </Box>
);

const BorrowNetworkSwitch = ({
  chains,
}: {
  readonly chains: ReadonlyArray<Chain>;
}) => {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { selectChain } = useScopedWalletChainSelection();
  const selection = useAtomValue(walletChainSelectionAtom);
  const [onlyChain] = chains;
  const onSwitchClick = () => {
    if (chains.length === 1 && onlyChain) {
      selectChain(onlyChain);
      return;
    }
    setPickerOpen(true);
  };

  return (
    <>
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.unsupported_network_description")}
      </BorrowNotice>

      {selection?.failedChainId !== undefined && (
        <BorrowNotice tone="error" title={t("wallet_modal.confirm_error")}>
          {t("dashboard.borrow.switch_network_error")}
        </BorrowNotice>
      )}

      <PageCtaButton
        cta={{
          disabled: false,
          isLoading: selection?.pendingChainId !== undefined,
          label: t("dashboard.borrow.switch_network"),
          onClick: onSwitchClick,
        }}
      />

      <WalletChainPicker
        chains={chains}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
      />
    </>
  );
};
