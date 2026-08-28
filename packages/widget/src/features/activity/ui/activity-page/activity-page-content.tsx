import { useTrackPage } from "../../../tracking/index";
import { useActivityPage } from "../../react/use-activity-page";
import { ActivityPagePresentation } from "./activity-page-presentation";

export const ActivityPageContent = ({
  allowDefaultSelection = false,
}: {
  readonly allowDefaultSelection?: boolean;
} = {}) => {
  useTrackPage("activity");

  const page = useActivityPage({ allowDefaultSelection });

  return <ActivityPagePresentation {...page} />;
};
