import { Duration } from "effect";
import { appRuntime } from "../../app/runtime/app-runtime";
import { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { withBorrowResourceError } from "../borrow/borrow-resource-error";

const borrowCatalogPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
});

export const borrowIntegrationsResourceAtom = appRuntime
  .atom(
    BorrowResourceSource.use((source) =>
      source
        .getIntegrations()
        .pipe(withBorrowResourceError("borrow-integrations"))
    )
  )
  .pipe(borrowCatalogPolicy);
