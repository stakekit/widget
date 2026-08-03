import { useAtomValue } from "@effect/atom-react";
import { geoBlockAtom } from "../state/geo-block";

export const useGeoBlock = () => useAtomValue(geoBlockAtom);
