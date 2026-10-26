import { describe, expect, it } from "vitest";
import {
  defaultPlaygroundConfig,
  readPlaygroundConfig,
  writePlaygroundConfig,
} from "../../playground/playground-config";

describe("Playground config link", () => {
  it("opens with the defaults when the link carries no config", () => {
    expect(readPlaygroundConfig("")).toEqual(defaultPlaygroundConfig);
    expect(readPlaygroundConfig("?token=avalanche-c-")).toEqual(
      defaultPlaygroundConfig
    );
  });

  it("restores changed settings from the link and keeps the widget's own parameters", () => {
    const config = {
      ...defaultPlaygroundConfig,
      hideGasFee: true,
      wallet: "scripted",
      yieldProviderOrder: { stake: ["benqi", "lido"] },
    } as const;

    const search = writePlaygroundConfig("?token=avalanche-c-", config);

    expect(new URLSearchParams(search).get("token")).toBe("avalanche-c-");
    expect(readPlaygroundConfig(search)).toEqual(config);
  });

  it("leaves default settings out of the link", () => {
    expect(writePlaygroundConfig("", defaultPlaygroundConfig)).toBe("");
    expect(
      writePlaygroundConfig("?token=avalanche-c-", {
        ...defaultPlaygroundConfig,
        hideGasFee: true,
      })
    ).toBe(
      `?token=avalanche-c-&playground=${encodeURIComponent('{"hideGasFee":true}')}`
    );
  });

  it("falls back to the defaults for a malformed link", () => {
    expect(readPlaygroundConfig("?playground=not-json")).toEqual(
      defaultPlaygroundConfig
    );
    expect(
      readPlaygroundConfig(
        `?playground=${encodeURIComponent('{"wallet":"unknown"}')}`
      )
    ).toEqual(defaultPlaygroundConfig);
  });
});
