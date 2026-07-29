type BorrowRiskSummaryProjection =
  | {
      readonly healthFactor: number | null;
      readonly ltv: number;
      readonly status: "available";
    }
  | {
      readonly status: "unavailable";
    };

export const makeBorrowRiskSummary = (
  projection: BorrowRiskSummaryProjection
) => {
  if (projection.status === "unavailable") {
    return { riskStatus: projection.status };
  }

  return {
    ...(projection.healthFactor == null
      ? {}
      : { projectedHealthFactor: projection.healthFactor.toString() }),
    projectedLtv: projection.ltv.toString(),
    riskStatus: projection.status,
  };
};
