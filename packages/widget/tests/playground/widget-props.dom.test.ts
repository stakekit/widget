import { describe, expect, it } from "vitest";
import {
  defaultPlaygroundConfig,
  type PlaygroundConfig,
} from "../../playground/playground-config";
import { toWidgetProps } from "../../playground/widget-props";
import { darkTheme, lightTheme } from "../../src/index.package";

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

  it("mounts single-theme host variants with their own theme", () => {
    expect(propsFor({ theme: "dark", variant: "utila" }).theme).toBe(
      lightTheme
    );
    expect(propsFor({ theme: "light", variant: "porto" }).theme).toBe(
      darkTheme
    );
  });

  it("mounts the selected theme for variants that support both", () => {
    expect(propsFor({ theme: "light", variant: "finery" }).theme).toBe(
      lightTheme
    );
    expect(propsFor({ theme: "dark", variant: "default" }).theme).toBe(
      darkTheme
    );
  });

  it("mounts Borrow only with the dashboard variant", () => {
    expect(
      propsFor({ borrowEnabled: true, dashboardVariant: false }).borrowEnabled
    ).toBe(false);
    expect(
      propsFor({ borrowEnabled: true, dashboardVariant: true }).borrowEnabled
    ).toBe(true);
  });
});
