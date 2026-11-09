import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSKWallet } from "../../../wallet/index";
import { WalletChainPicker } from "../../../wallet/views";
import { ShellNotice } from "../shell-notice";

/**
 * The notice shown while the host's wallet is on a network not enabled for
 * the Widget. "Switch network" opens the network picker over the networks
 * the wallet can switch to; once it lands on one, the Widget shows again.
 */
export const NetworkNotSupported = () => {
  const { t } = useTranslation();
  const chains = useSKWallet()?.connectorChains ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <ShellNotice
        testId="network-not-supported"
        icon="ArrowsLeftRightIcon"
        title={t("help_modals.network_not_supported.title")}
        description={t("help_modals.network_not_supported.description")}
        {...(chains.length > 0
          ? {
              action: {
                label: t("help_modals.network_not_supported.switch_network"),
                onClick: () => setPickerOpen(true),
              },
            }
          : {})}
      />
      <WalletChainPicker
        chains={chains}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
      />
    </>
  );
};
