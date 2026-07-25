import { useAtomValue } from "@effect/atom-react";
import { underMaintenanceAtom } from "../../../resources/widget-health/widget-health";

export const useUnderMaintenance = () => useAtomValue(underMaintenanceAtom);
