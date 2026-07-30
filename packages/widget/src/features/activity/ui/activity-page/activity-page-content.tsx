import { useTrackPage } from "../../../tracking/state";
import { useActivityPage } from "../../react/use-activity-page";
import type { ActivityResumePresentation } from "../../state/start-activity-resume";
import { ActivityPagePresentation } from "./activity-page-presentation";

export const ActivityPageContent = ({
  resumePresentation,
}: {
  readonly resumePresentation: ActivityResumePresentation;
}) => {
  useTrackPage("activity");

  const page = useActivityPage({ resumePresentation });

  return <ActivityPagePresentation {...page} />;
};
