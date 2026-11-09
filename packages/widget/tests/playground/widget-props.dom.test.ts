import { describe, expect, it } from "vitest";

import {
  defaultPlaygroundConfig,
  type PlaygroundConfig,
} from "../../playground/playground-config";
import { toWidgetProps } from "../../playground/widget-props";

const storedConnection = {
  apiKey: "stored-key",
  apiUrl: "https://api.example/",
  yieldsApiUrl: "",
  borrowApiUrl: "",
};

const propsFor = (changes: Partial<PlaygroundConfig>) =>
  toWidgetProps({ ...defaultPlaygroundConfig, ...changes }, storedConnection);

describe("Playground widget props", () => {
  it("never takes connection props from a link's extra props", () => {
    const props = propsFor({
      extraProps: {
        apiKey: "link-key",
        baseUrl: "https://attacker.example/",
        yieldsApiUrl: "https://attacker.example/",
        borrowApiUrl: "https://attacker.example/",
        hideNetworkLogo: true,
      },
    });

    expect(props).toMatchObject({
      apiKey: "stored-key",
      baseUrl: "https://api.example/",
      hideNetworkLogo: true,
    });
    expect(props).not.toHaveProperty("yieldsApiUrl");
    expect(props).not.toHaveProperty("borrowApiUrl");
  });

  it("mounts single-scheme host variants with their own color scheme", () => {
    expect(
      propsFor({ colorScheme: "dark", variant: "utila" }).appearance
    ).toEqual({ colorScheme: "light" });
    expect(
      propsFor({ colorScheme: "system", variant: "porto" }).appearance
    ).toEqual({ colorScheme: "dark" });
  });

  it("mounts the selected color scheme for variants that support both", () => {
    expect(
      propsFor({ colorScheme: "system", variant: "finery" }).appearance
    ).toEqual({ colorScheme: "system" });
    expect(
      propsFor({ colorScheme: "light", variant: "default" }).appearance
    ).toEqual({ colorScheme: "light" });
  });

  it("mounts Borrow only with the dashboard layout", () => {
    expect(
      propsFor({ borrowEnabled: true, layout: "compact" }).borrowEnabled
    ).toBe(false);
    expect(
      propsFor({ borrowEnabled: true, layout: "dashboard" }).borrowEnabled
    ).toBe(true);
  });
});
