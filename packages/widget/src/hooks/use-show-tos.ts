import { useSettings } from "../providers/settings";
import { setStorageItem } from "../services/local-storage";
import { useLocalStorageValue } from "./use-local-storage-value";

export const useShowTOS = () => {
  const tosAccepted = useLocalStorageValue("sk-widget@1//tosAccepted");

  const onAccept = () => setStorageItem("sk-widget@1//tosAccepted", true);

  const { variant } = useSettings();

  return {
    onAccept,
    tosAccepted,
    enabled: variant === "utila",
  };
};
