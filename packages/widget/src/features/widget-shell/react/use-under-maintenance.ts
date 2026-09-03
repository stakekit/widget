import { useAtomValue } from "@effect/atom-react";
import { underMaintenanceAtom } from "../../../resources/widget-health/index";

export const useUnderMaintenance = () => useAtomValue(underMaintenanceAtom);
