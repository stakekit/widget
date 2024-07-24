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

  const url = new URL("http://localhost:5173/");
  url.search = searchParams.toString();

  Object.defineProperty(window, "location", {
    value: {
      href: url.href,
      hostname: url.hostname,
      origin: url.origin,
      search: url.search,
    },
  });

  return {
    origin: url.origin,
    url,
  };
};
