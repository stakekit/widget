import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import createStateContext from "../../../utils/create-state-context";

export const [useHeaderHeight, HeaderHeightProvider] = createStateContext(0);

export const useSyncHeaderHeight = () => {
  return useSyncElementHeight(useHeaderHeight()[1]);
};
