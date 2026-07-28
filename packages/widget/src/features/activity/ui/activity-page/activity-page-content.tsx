import { useTrackPage } from "../../../tracking/state";
import { useActivityPage } from "../../react/use-activity-page";
import type { ActivityResumeMode } from "../../state/start-activity-resume";
import { ActivityPagePresentation } from "./activity-page-presentation";

export const ActivityPageContent = ({
  resumeMode,
}: {
  readonly resumeMode: ActivityResumeMode;
}) => {
  useTrackPage("activity");

  const page = useActivityPage({ resumeMode });

  return <ActivityPagePresentation {...page} />;
};
