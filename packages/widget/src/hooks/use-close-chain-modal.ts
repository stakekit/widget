let latestCloseModalFn = () => {};

export const useCloseChainModal = () => {
  return {
    closeChainModal: latestCloseModalFn,
    setCloseChainModal: (fn: () => void) => {
      latestCloseModalFn = fn;
    },
  };
};
