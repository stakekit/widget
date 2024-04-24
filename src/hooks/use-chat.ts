import { useEffect } from "react";
import { useSettings } from "../providers/settings";
import { useSKWallet } from "../providers/sk-wallet";
import { MaybeDocument } from "../utils/maybe-document";
import { initIntercom } from "../services/chat";
import { config } from "../config";

export const useChat = () => {
  const { address } = useSKWallet();

  const { enableSupport } = useSettings();

  useEffect(() => {
    MaybeDocument.filter(() => !!enableSupport).ifJust(() => {
      initIntercom(config.intercom.appId);
      window.Intercom?.("boot", {
        api_base: config.intercom.apiBase,
        app_id: config.intercom.appId,
      });
    });
  }, [enableSupport]);

  useEffect(() => {
    MaybeDocument.filter(() => !!enableSupport).ifJust(() => {
      window.Intercom?.("update", { address: address ?? undefined });
    });
  }, [address, enableSupport]);

  useEffect(() => {
    MaybeDocument.ifJust(() =>
      window.Intercom?.("update", { hide_default_launcher: false })
    );

    return () => {
      MaybeDocument.ifJust(() =>
        window.Intercom?.("update", { hide_default_launcher: true })
      );
    };
  }, []);
};
