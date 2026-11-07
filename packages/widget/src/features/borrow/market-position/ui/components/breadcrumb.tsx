import { useTranslation } from "react-i18next";
import {
  type WidgetPath,
  widgetRoutes,
} from "../../../../../services/navigation/widget-routes";
import { PageHeader } from "../../../../../ui/index";
import { useWidgetNavigate } from "../../../../navigation/index";

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
    <PageHeader
      parent={t("dashboard.position_details.breadcrumb_root")}
      {...(positionName ? { title: positionName } : {})}
      back={{
        label: t("shared.back"),
        onClick: () => navigation.push(backPath),
        testId: "borrow-position-details-back",
      }}
    />
  );
};
