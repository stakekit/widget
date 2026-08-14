import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { PageCtaButton } from "../../src/features/widget-shell/components";
import { render } from "../utils/test-utils.dom.tsx";

const settings = {
  apiKey: "test-api-key",
  variant: "default" as const,
};

describe("PageCtaButton", () => {
  it("prevents clicks while loading", async () => {
    const onClick = vi.fn();
    const renderButton = (isLoading: boolean) => (
      <SKAtomRegistryProvider
        routes={applicationRoutes}
        hostConfiguration={settings}
      >
        <PageCtaButton
          cta={{
            disabled: false,
            isLoading,
            label: "Confirm",
            onClick,
          }}
        />
      </SKAtomRegistryProvider>
    );
    const app = await render(renderButton(true));
    const button = app.container.querySelector<HTMLButtonElement>("button");

    expect(button?.disabled).toBe(true);

    act(() => button?.click());
    expect(onClick).not.toHaveBeenCalled();

    await app.rerender(renderButton(false));

    expect(button?.disabled).toBe(false);

    act(() => button?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });
});
