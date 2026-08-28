import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const sourceRoot = join(packageRoot, "src");

const sourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });

describe("feature facade architecture", () => {
  it("keeps retired catch-all and pass-through modules deleted", () => {
    const retiredPaths = [
      "domain/index.ts",
      "features/earn/state/runtime.ts",
      "features/position-details/state/classic-actions/runtime.ts",
      "features/position-details/views.ts",
      "resources/borrow/index.ts",
      "resources/borrow/borrow-resource-error.ts",
      "services/wallet/wallet-scope.ts",
    ];

    for (const path of retiredPaths) {
      expect(existsSync(join(sourceRoot, path)), path).toBe(false);
    }
  });

  it("does not retain the aggregate Earn bridge", () => {
    const aggregateModel = join(
      sourceRoot,
      "features/earn/ui/classic/earn-page/state/earn-page-model.tsx"
    );
    expect(existsSync(aggregateModel)).toBe(false);

    const source = sourceFiles(sourceRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toContain("useEarnPageModel");
    expect(source).not.toContain("EarnPageModelBinding");
    expect(source).not.toContain("useEarnMachine");
    expect(source).not.toContain("useYieldKycGate");
    expect(source).not.toContain("useYieldValidators");
    expect(source).not.toContain("earn/resources/prices");
    expect(source).not.toContain("earn/resources/yield-insights");
    expect(source).not.toContain("earn/resources/yield-validators");
    expect(source).not.toContain("loadedValidatorsAtom");
  });

  it("does not retain React navigation or Yield Summary bridges", () => {
    const source = sourceFiles(sourceRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toContain("executeWidgetNavigationCommand");
    expect(source).not.toContain('from "../../../../yield-summary/react"');
    expect(source).not.toContain('from "../../../../../yield-summary/react"');
    expect(source).not.toContain("yieldSummaryViewAtom");
  });

  it("does not retain the React-to-runtime router adapter bridge", () => {
    const app = readFileSync(join(sourceRoot, "App.tsx"), "utf8");
    const source = sourceFiles(sourceRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(app).not.toContain("createMemoryRouter");
    expect(app).toContain('from "react-router/dom"');
    expect(source).not.toContain("WidgetNavigationAdapter");
    expect(source).not.toContain("widgetNavigationAdapterAtom");
  });

  it("does not make Position Details read one Atom to discover its facade Atoms", () => {
    const adapter = readFileSync(
      join(
        sourceRoot,
        "features/position-details/ui/dashboard/hooks/use-position-details-stake.ts"
      ),
      "utf8"
    );
    expect(adapter).not.toContain("positionDetailsStakeFacadeAtom");
  });

  it("keeps remaining workflow transitions out of React adapters", () => {
    const pendingActions = readFileSync(
      join(
        sourceRoot,
        "features/position-details/state/classic-actions/pending-action.ts"
      ),
      "utf8"
    );
    const positionDetails = readFileSync(
      join(sourceRoot, "features/position-details/composition.ts"),
      "utf8"
    );
    const positionDetailsStateAdapter = readFileSync(
      join(
        sourceRoot,
        "features/position-details/react/use-unstake-or-pending-action.ts"
      ),
      "utf8"
    );
    const activityPage = readFileSync(
      join(sourceRoot, "features/activity/react/use-activity-page.ts"),
      "utf8"
    );
    const pendingActionRoute = readFileSync(
      join(sourceRoot, "app/routes/state/pending-action-deep-link-route.ts"),
      "utf8"
    );

    expect(pendingActions).not.toContain("useEffect");
    expect(pendingActions).not.toContain("useNavigate");
    expect(pendingActions).not.toContain("useStartClassicTransactionFlow");
    expect(pendingActions).not.toContain("useMemo");
    expect(positionDetailsStateAdapter).not.toContain("useMemo");
    expect(positionDetailsStateAdapter).not.toContain(
      "reducePositionDetailsWorkflow"
    );
    expect(positionDetailsStateAdapter).not.toContain(
      "getYieldAmountConstraints"
    );
    expect(positionDetails).not.toContain("useState");
    expect(positionDetails).not.toContain("useStartClassicTransactionFlow");
    expect(activityPage).not.toContain("useStartClassicTransactionFlow");
    expect(pendingActionRoute).not.toContain("classic-transaction-flow/state/");
  });

  it("keeps resource acquisition neutral and presentation observer-scoped", () => {
    const transport = readFileSync(
      join(sourceRoot, "services/api/transport.ts"),
      "utf8"
    );
    const apiOperation = readFileSync(
      join(sourceRoot, "services/api/api-operation.ts"),
      "utf8"
    );
    const activity = readFileSync(
      join(sourceRoot, "features/activity/state/page-resources.ts"),
      "utf8"
    );
    const resourceFiles = sourceFiles(join(sourceRoot, "resources")).filter(
      (path) => readFileSync(path, "utf8").includes("ResourceSource")
    );

    expect(transport).not.toContain("RichErrorService");
    expect(transport).not.toContain("publishRichErrors");
    expect(apiOperation).toContain("presentApiRequestError");
    expect(activity).toContain("enrichedYieldOpportunityResourceAtom.local");
    expect(activity).toContain("validatorByAddressAtom.local");
    expect(activity).toContain("activityHistoryPullAtom.foreground");
    expect(activity).toContain("activityCountResourceAtom.local");
    expect(
      resourceFiles.every((path) =>
        readFileSync(path, "utf8").includes("makePresentableResource")
      )
    ).toBe(true);
  });
});
