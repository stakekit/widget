export const setUrl = ({
  accountId,
  yieldId,
  pendingaction,
  network,
}:
  | {
      yieldId?: string;
      accountId?: string;
      pendingaction?: string;
      network?: never;
    }
  | {
      network: string;
      yieldId?: never;
      accountId?: never;
      pendingaction?: never;
    }) => {
  const searchParams = new URLSearchParams();

  if (network) {
    searchParams.set("network", network);
  }
  if (yieldId) {
    searchParams.set("yieldId", yieldId);
  }
  if (accountId) {
    searchParams.set("accountId", accountId);
  }
  if (pendingaction) {
    searchParams.set("pendingaction", pendingaction);
  }

  const url = new URL(window.location.href);
  url.search = searchParams.toString();

  window.history.pushState({}, "", url);

  return {
    origin: url.origin,
    url,
  };
};
