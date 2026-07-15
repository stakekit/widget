export const isWalletIframe = () => window.parent !== window;

export const isMobileWalletEnvironment = () => {
  const hasTouchEvent = () => {
    try {
      document.createEvent("TouchEvent");
      return true;
    } catch {
      return false;
    }
  };

  return (
    /android|blackberry|iemobile|ipad|iphone|ipod|kindle|mobile|opera mini|silk|windows phone/i.test(
      navigator.userAgent
    ) || hasTouchEvent()
  );
};

export const isLedgerDappBrowserProvider = (() => {
  let state: boolean | null = null;

  return (): boolean => {
    if (typeof state === "boolean") return state;

    try {
      const params = new URLSearchParams(window.self.location.search);
      state = Boolean(params.get("embed"));
    } catch {
      state = false;
    }

    return state;
  };
})();
