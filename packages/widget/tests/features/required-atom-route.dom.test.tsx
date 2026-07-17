import { RegistryProvider } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { makeRequiredAtomRoute } from "../../src/shared/react/required-atom-route";
import { render } from "../utils/test-utils.dom";

const inputAtom = Atom.make<{ readonly id: string } | null>(null);
const inputRoute = makeRequiredAtomRoute(inputAtom, "TestInput");

const InputProbe = () => {
  const input = inputRoute.useRequiredValue();

  return <div data-testid="input">{input.id}</div>;
};

const renderRoute = (input: { readonly id: string } | null) =>
  render(
    <RegistryProvider initialValues={[[inputAtom, input]]}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<inputRoute.RouteGuard />}>
            <Route path="protected" element={<InputProbe />} />
          </Route>
          <Route path="/" element={<div data-testid="home">home</div>} />
        </Routes>
      </MemoryRouter>
    </RegistryProvider>
  );

describe("required atom route", () => {
  it("provides a typed value to protected content", async () => {
    const app = await renderRoute({ id: "request-1" });

    expect(
      app.container.querySelector('[data-testid="input"]')?.textContent
    ).toBe("request-1");
  });

  it("redirects when the atom value is missing", async () => {
    const app = await renderRoute(null);

    expect(
      app.container.querySelector('[data-testid="home"]')?.textContent
    ).toBe("home");
  });
});
