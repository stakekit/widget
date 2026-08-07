import BigNumber from "bignumber.js";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RootElementProvider } from "../../src/shared/react/root-element";
import { NumberInput } from "../../src/shared/ui/components/number-input";
import {
  type WidgetPresentation,
  WidgetPresentationProvider,
} from "../../src/shared/ui/widget-presentation";
import { render } from "../utils/test-utils.dom";

const presentation = (locale: string): WidgetPresentation => ({
  disableInputAutoResize: true,
  hideNetworkLogo: false,
  locale,
  mapNetworkIconUrl: () => undefined,
  mapTokenIconUrl: () => undefined,
  portalContainer: undefined,
  variant: "default",
});

const setNativeInputValue = (input: HTMLInputElement, value: string) => {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  if (!setValue) throw new Error("Expected native input setter");

  setValue.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("NumberInput locale integration", () => {
  it("uses the presentation locale for editing, parsing, and blur formatting", async () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState(new BigNumber(0));

      return (
        <WidgetPresentationProvider value={presentation("fr")}>
          <RootElementProvider>
            <NumberInput
              value={value}
              onChange={(next) => {
                onChange(next);
                setValue(next);
              }}
            />
          </RootElementProvider>
        </WidgetPresentationProvider>
      );
    };
    const app = await render(<Harness />);
    const input = app.container.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Expected number input");

    await act(async () => input.focus());
    await act(async () => setNativeInputValue(input, "1234,5"));

    expect(onChange.mock.lastCall?.[0].toFixed()).toBe("1234.5");
    expect(input.value).toBe("1234,5");

    await act(async () => input.blur());
    expect(input.value).toBe("1 234,5");

    await act(async () => input.focus());
    expect(input.value).toBe("1234,5");
  });
});
