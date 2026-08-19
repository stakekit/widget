import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PositionDetailsBreadcrumb } from "../../../../../shared/ui/components/position-details";
import { BackButton, BackButtonProvider } from "../../../../widget-shell/views";

export const BorrowPositionBreadcrumb = ({
  backPath = "/positions",
  positionName,
}: {
  readonly backPath?: string;
  readonly positionName: string | null;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <BackButtonProvider>
      <PositionDetailsBreadcrumb
        backButton={
          <BackButton
            data-testid="borrow-position-details-back"
            onClick={() => navigate(backPath)}
          />
        }
        positionName={positionName}
        rootLabel={t("dashboard.position_details.breadcrumb_root")}
      />
    </BackButtonProvider>
  );
};
