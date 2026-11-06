import { useAtomSet } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import {
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Notice,
} from "../../../../ui/index";
import { useWidgetNavigate } from "../../../navigation/index";
import { ConnectWalletState } from "../../../wallet/views";
import { retryPositionsAtom } from "../../state/retry-positions";

/** The Manage list while its first load runs: rows shaped like positions. */
export const PositionsSkeleton = () => {
  const { t } = useTranslation();

  return (
    <ListSkeleton testId="positions-skeleton" label={t("positions.loading")} />
  );
};

/** No positions yet: it leads to Earn. */
export const PositionsEmpty = () => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();

  return (
    <EmptyState
      fill
      testId="positions-empty"
      icon="LayersIcon"
      title={t("positions.empty_title")}
      body={t("positions.empty_description")}
      action={{
        label: t("shared.start_earning"),
        onClick: () => void navigation.push(widgetRoutes.earn.build()),
      }}
    />
  );
};

/** No wallet: positions show once one connects. */
export const PositionsConnectWallet = ({
  title,
}: {
  readonly title: string;
}) => <ConnectWalletState testId="positions-connect-wallet" title={title} />;

/** The positions failed to load with nothing to show: retry them here. */
export const PositionsLoadFailed = () => {
  const { t } = useTranslation();
  const retry = useAtomSet(retryPositionsAtom);

  return (
    <ErrorState
      fill
      testId="positions-error"
      title={t("positions.load_failed_title")}
      body={t("shared.load_failed_description")}
      action={{ label: t("shared.retry"), onClick: () => retry(undefined) }}
    />
  );
};

/** Some positions failed to load; those that loaded stay listed above it. */
export const PositionsPartiallyLoaded = () => {
  const { t } = useTranslation();
  const retry = useAtomSet(retryPositionsAtom);

  return (
    <Notice
      tone="warning"
      testId="positions-partial-error"
      action={
        <Button size="sm" onClick={() => retry(undefined)}>
          {t("shared.retry")}
        </Button>
      }
    >
      {t("dashboard.details.positions_partial_error")}
    </Notice>
  );
};
