import { describe, expect, it } from "vitest";
import { getSourceArchitectureViolations } from "../../scripts/architecture-rules";

describe("application architecture boundary", () => {
  it("rejects generated imports from application consumers", () => {
    expect(
      getSourceArchitectureViolations(
        "src/hooks/use-example.ts",
        'import type { YieldDto } from "../generated/api/yield";'
      )
    ).toHaveLength(1);
  });

  it("allows generated imports only in approved domain schemas and transport", () => {
    expect(
      getSourceArchitectureViolations(
        "src/domain/schema/example.ts",
        'import * as Api from "../../generated/api/yield-schema";'
      )
    ).toEqual([]);
    expect(
      getSourceArchitectureViolations(
        "src/providers/api/api-client.ts",
        'import * as Api from "../../generated/api/yield";'
      )
    ).toEqual([]);
  });

  it("rejects widget-owned TanStack resources", () => {
    expect(
      getSourceArchitectureViolations(
        "src/hooks/use-example.ts",
        'import { useQuery } from "@tanstack/react-query";'
      )
    ).toHaveLength(1);
    expect(
      getSourceArchitectureViolations(
        "src/providers/query-client/index.tsx",
        'import { QueryClient } from "@tanstack/react-query";'
      )
    ).toEqual([]);
  });
});
