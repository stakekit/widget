import type { RiskPosition } from "../../../../domain/borrow/risk/risk-position";
import type { BorrowRiskProjection } from "./types";

type DomainRiskProjection = ReturnType<RiskPosition["assess"]>["projection"];

export const toBorrowRiskProjection = ({
  current,
  projected,
}: {
  readonly current: RiskPosition["current"];
  readonly projected: DomainRiskProjection;
}): BorrowRiskProjection => {
  if (projected.status === "unavailable") {
    return {
      currentLtv: current.status === "available" ? current.ltv : null,
      status: "unavailable",
    };
  }

  return {
    currentLtv: current.status === "available" ? current.ltv : null,
    maxLtv: projected.maxLtv,
    projectedHealthFactor: projected.healthFactor,
    projectedLtv: projected.ltv,
    status: "available",
  };
};
