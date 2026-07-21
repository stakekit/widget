import type { ClassicTransactionFlowIntake } from "../../features/classic-transaction-flow/model/classic-transaction-flow";

export const isClassicFlowSessionPath = (
  pathname: string,
  variant: ClassicTransactionFlowIntake["_tag"]
): boolean => {
  switch (variant) {
    case "Enter":
      return /^\/(?:review|steps|complete)\/?$/.test(pathname);
    case "Exit":
      return /^\/positions\/[^/]+\/[^/]+\/unstake\/(?:review|steps|complete)\/?$/.test(
        pathname
      );
    case "Manage":
      return /^\/positions\/[^/]+\/[^/]+\/pending-action\/(?:review|steps|complete)\/?$/.test(
        pathname
      );
    case "ActivityResume":
      return /^\/activity\/(?:review|[^/]+\/(?:steps|complete))\/?$/.test(
        pathname
      );
  }
};
