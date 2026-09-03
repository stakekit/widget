export const normalizeChainId = (chainId: string) => {
  const numericChainId = Number(chainId);

  return Number.isNaN(numericChainId)
    ? (chainId as unknown as number)
    : numericChainId;
};
