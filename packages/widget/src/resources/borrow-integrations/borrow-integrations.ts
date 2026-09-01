import { Duration, Effect } from "effect";
import { appRuntime } from "../../app/runtime/app-runtime";
import { BorrowResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { withBorrowResourceError } from "../borrow-resource-error";
import { makePresentableResource } from "../resource-failure-presentation";

const borrowCatalogPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

const borrowIntegrationsCanonicalAtom = appRuntime
  .atom(
    BorrowResourceSource.use((source) =>
      source.getIntegrations.pipe(
        Effect.catchTag("BorrowFeatureDisabled", () => Effect.succeed([])),
        withBorrowResourceError("borrow-integrations")
      )
    )
  )
  .pipe(borrowCatalogPolicy);

export const borrowIntegrationsResourceAtom = makePresentableResource(
  borrowIntegrationsCanonicalAtom
);
