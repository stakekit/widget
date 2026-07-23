import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveCanaryVersion,
  prepareCanaryRelease,
} from "./prepare-canary-release";

describe("deriveCanaryVersion", () => {
  it("derives a patch canary from the current stable release", () => {
    expect(
      deriveCanaryVersion({
        currentVersion: "0.0.282",
        latestVersion: "0.0.282",
        runNumber: "418",
      })
    ).toBe("0.0.283-canary.418");
  });

  it("rejects a stale selected branch", () => {
    expect(() =>
      deriveCanaryVersion({
        currentVersion: "0.0.281",
        latestVersion: "0.0.282",
        runNumber: "420",
      })
    ).toThrow(/Rebase or update the branch/);
  });

  it("rejects a prerelease branch version", () => {
    expect(() =>
      deriveCanaryVersion({
        currentVersion: "0.0.283-canary.1",
        latestVersion: "0.0.282",
        runNumber: "421",
      })
    ).toThrow(/must be a stable semantic version/);
  });

  it("rejects invalid run numbers", () => {
    expect(() =>
      deriveCanaryVersion({
        currentVersion: "0.0.282",
        latestVersion: "0.0.282",
        runNumber: "0",
      })
    ).toThrow(/must be a positive integer/);
  });
});

describe("prepareCanaryRelease", () => {
  it("updates only the runner package version and writes action outputs", () => {
    const directory = mkdtempSync(join(tmpdir(), "stakekit-canary-"));
    const packageJsonPath = join(directory, "package.json");
    const githubOutput = join(directory, "github-output");

    writeFileSync(
      packageJsonPath,
      `${JSON.stringify({ name: "@stakekit/widget", version: "0.0.282" })}\n`
    );
    writeFileSync(githubOutput, "");

    expect(
      prepareCanaryRelease({
        packageDir: directory,
        latestVersion: "0.0.282",
        runNumber: "422",
        githubOutput,
      })
    ).toBe("0.0.283-canary.422");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      readonly version: string;
    };
    expect(packageJson.version).toBe("0.0.283-canary.422");
    expect(readFileSync(githubOutput, "utf8")).toBe(
      "base_version=0.0.282\nversion=0.0.283-canary.422\n"
    );
  });
});
