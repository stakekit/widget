import { Schema } from "effect";
import { InitParams } from "../../domain/schema/init-params";

export const decodeInitParams = ({
  externalProviderInitToken,
  href,
}: {
  readonly externalProviderInitToken: string | null;
  readonly href: string;
}) => {
  const url = new URL(href);
  const token = url.searchParams.get("token") ?? externalProviderInitToken;

  return Schema.decodeUnknownSync(InitParams)({
    accountId: url.searchParams.get("accountId"),
    balanceId: url.searchParams.get("balanceId"),
    network:
      url.searchParams.get("network") ??
      (token?.includes("-") ? token.split("-").slice(0, -1).join("-") : null),
    pendingaction: url.searchParams.get("pendingaction"),
    tab: url.searchParams.get("tab"),
    token,
    validator: url.searchParams.get("validator"),
    yieldId: url.searchParams.get("yieldId"),
  });
};
