import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { useEffect } from "react";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";

export const useTrackStateEvents = ({
  initToken,
  initYield,
}: {
  initToken: Maybe<TokenDto>;
  initYield: Maybe<YieldDto>;
}) => {
  const trackEvent = useTrackEvent();

  /**
   * Track init yield selected event
   */
  useEffect(() => {
    initYield.ifJust((v) =>
      trackEvent("initYield", {
        yieldId: v.id,
        network: v.token.network,
        tokenName: v.token.name,
        tokenAddress: v.token.address,
        tokenSymbol: v.token.symbol,
      })
    );
  }, [initYield, trackEvent]);

  /**
   * Track init token selected event
   */
  useEffect(() => {
    initToken.ifJust((v) =>
      trackEvent("initToken", {
        name: v.name,
        network: v.network,
        address: v.address,
        symbol: v.symbol,
        decimals: v.decimals,
      })
    );
  }, [initToken, trackEvent]);
};
