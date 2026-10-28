import { useTranslation } from "react-i18next";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../../services/navigation/widget-routes";
import { PositionDetailsBreadcrumb } from "../../../../../shared/ui/components/position-details";
import { useWidgetNavigate } from "../../../../navigation/index";
import { BackButton, BackButtonProvider } from "../../../../widget-shell/views";

export const BorrowPositionBreadcrumb = ({
  backPath = widgetRoutes.positions.build(),
  positionName,
}: {
  readonly backPath?: WidgetPath;
  readonly positionName: string | null;
}) => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();

  return (
    <BackButtonProvider>
      <PositionDetailsBreadcrumb
        backButton={
          <BackButton
            data-testid="borrow-position-details-back"
            onClick={() => navigation.push(backPath)}
          />
        }
        positionName={positionName}
        rootLabel={t("dashboard.position_details.breadcrumb_root")}
      />
    </BackButtonProvider>
  );
};
