import { HttpResponse, http } from "msw";

import { HelpModal } from "../../../src/index.package";
import { yieldApiRoute } from "../../mocks/api-routes";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

/** Opens a host-placed help dialog from its default trigger. */
const openHelp = async (
  modal: Parameters<typeof HelpModal>[0]["modal"],
  name: string
) => {
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      children: <HelpModal modal={modal} />,
    },
  });
  await app.getByRole("button", { name }).click();
  const dialog = app.getByRole("dialog", { name });
  await expect.element(dialog).toBeVisible();
  return { app, dialog };
};

const newTab = (label: string) => `${label} opens in a new tab`;

describe("HelpModal content", () => {
  it("explains Yield.xyz and leads to its site and FAQ", async () => {
    const { app, dialog } = await openHelp(
      { type: "whatIsStakeKit" },
      "What is Yield.xyz?"
    );

    await expect
      .element(dialog)
      .toHaveAccessibleDescription(
        "Yield.xyz lets you earn self-custodial yield across all major networks and tokens in a few clicks."
      );
    await expect
      .element(dialog.getByRole("link", { name: newTab("Visit yield.xyz") }))
      .toHaveAttribute("href", "https://yield.xyz/");
    await expect
      .element(dialog.getByRole("link", { name: newTab("Read the FAQ") }))
      .toHaveAttribute("href", "https://docs.yield.xyz/docs/faqs");

    await app.unmount();
  });

  it("says where help is and names each destination", async () => {
    const { app, dialog } = await openHelp(
      { type: "getInTouch" },
      "Need help?"
    );

    await expect
      .element(dialog)
      .toHaveAccessibleDescription(
        "Questions about a yield or your position? Read the FAQ or message our team on X."
      );
    await expect
      .element(dialog.getByRole("link", { name: newTab("Read the FAQ") }))
      .toHaveAttribute("href", "https://docs.yield.xyz/docs/faqs");
    await expect
      .element(dialog.getByRole("link", { name: newTab("Message us on X") }))
      .toHaveAttribute("href", "https://x.com/yield_xyz");

    await app.unmount();
  });

  it("names the blocked country, links each sanctions list by name, and closes on Got it", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/networks"), () =>
        HttpResponse.json(
          {
            code: 403,
            countryCode: "CU",
            message: "Access denied",
            regionCode: "CU-03",
            tags: ["OFAC", "OFSI"],
            type: "GEO_LOCATION",
          },
          { status: 403 }
        )
      )
    );
    const app = await renderApp();

    const dialog = app.getByRole("dialog", { name: "Not available in Cuba" });
    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog.getByRole("link", { name: newTab("OFAC sanctions") }))
      .toHaveAttribute(
        "href",
        "https://ofac.treasury.gov/sanctions-programs-and-country-information"
      );
    await expect
      .element(dialog.getByRole("link", { name: newTab("OFSI sanctions") }))
      .toHaveAttribute(
        "href",
        "https://www.gov.uk/government/collections/financial-sanctions-regime-specific-consolidated-lists-and-releases"
      );

    await dialog.getByRole("button", { name: "Got it" }).click();

    await expect.element(dialog).not.toBeInTheDocument();

    await app.unmount();
  });
});
