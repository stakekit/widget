export const getBorrowFlowRoutes = (marketId?: string) => {
  const basePath = marketId ? `/positions/borrow/${marketId}` : "/borrow";

  return {
    basePath,
    completePath: `${basePath}/complete`,
    reviewPath: `${basePath}/review`,
    stepsPath: `${basePath}/steps`,
  };
};
