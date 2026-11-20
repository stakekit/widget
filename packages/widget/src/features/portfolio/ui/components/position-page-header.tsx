import { useTranslation } from "react-i18next";

import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { PageHeader } from "../../../../ui/index";
import { useWidgetNavigate } from "../../../navigation/index";
import { useTrackEvent } from "../../../tracking/index";

/**
 * The head of a page nested under the positions list, such as a yield or a
 * borrow position: back, then the trail from the list's tab to the page.
 * Back returns to the positions list, or, while a flow runs in the page,
 * steps back through the Widget's history.
 */
export const PositionPageHeader = ({
  back,
  title,
}: {
  readonly back: "PositionsList" | "History";
  /** The page's name; null, the trail stops at the tab. */
  readonly title: string | null;
}) => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();
  const trackEvent = useTrackEvent();

  const goBack = () => {
    trackEvent("backClicked");
    if (back === "History") {
      void navigation.back();
      return;
    }
    void navigation.push(widgetRoutes.positions.build());
  };

  return (
    <PageHeader
      parent={t("tabs.manage")}
      {...(title === null ? {} : { title })}
      back={{
        label: t("shared.back"),
        onClick: goBack,
        testId: "position-page-back",
      }}
    />
  );
};
