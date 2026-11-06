import { useTranslation } from "react-i18next";

import type { MarketPosition } from "../../../../../domain/borrow/positions/market-position";
import { useTokenLogo } from "../../../../../shared/react/token-logo";
import { AssetHeader } from "../../../../../ui/index";
import type { BorrowPositionDetailsModel } from "../../model/details";

/**
 * The head of a market position's page: a 40px logo, the pair, who provides
 * it and its network. The risk shows in the summary under it, so no status.
 */
export const BorrowPositionHeader = ({
  model,
  position,
}: {
  readonly model: BorrowPositionDetailsModel;
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();
  const headerLogo = useTokenLogo(model.headerToken);
  const providerLogo = position.integration.metadata.logoURI;

  return (
    <AssetHeader
      density="compact"
      title={model.title}
      token={headerLogo}
      provider={{
        name: model.providerName,
        label: t("positions.via", {
          providerName: model.providerName,
          count: 1,
        }),
        ...(providerLogo ? { src: providerLogo } : {}),
      }}
      details={[model.networkName]}
    />
  );
};
