import { useSyncExternalStore } from "react";
import {
  getGeoBlockSnapshot,
  subscribeToGeoBlock,
} from "../../../services/api/geo-block-state";

export const useGeoBlock = () =>
  useSyncExternalStore(
    subscribeToGeoBlock,
    getGeoBlockSnapshot,
    getGeoBlockSnapshot
  );
