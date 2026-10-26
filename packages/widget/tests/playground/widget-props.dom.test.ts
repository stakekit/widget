import { describe, expect, it } from "vitest";
import { defaultPlaygroundConfig } from "../../playground/playground-config";
import { toWidgetProps } from "../../playground/widget-props";

const storedConnection = {
  apiKey: "stored-key",
  apiUrl: "https://api.example/",
  yieldsApiUrl: "",
  borrowApiUrl: "",
};

describe("Playground widget props", () => {
  it("never takes connection props from a link's extra props", () => {
    const props = toWidgetProps(
      {
        ...defaultPlaygroundConfig,
        extraProps: {
          apiKey: "link-key",
          baseUrl: "https://attacker.example/",
          yieldsApiUrl: "https://attacker.example/",
          borrowApiUrl: "https://attacker.example/",
          hideNetworkLogo: true,
        },
      },
      storedConnection
    );

    expect(props).toMatchObject({
      apiKey: "stored-key",
      baseUrl: "https://api.example/",
      hideNetworkLogo: true,
    });
    expect(props).not.toHaveProperty("yieldsApiUrl");
    expect(props).not.toHaveProperty("borrowApiUrl");
  });
});
