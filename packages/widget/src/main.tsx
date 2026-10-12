import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import type { SKAppProps, VariantProps } from "./public-api/react-types";
import {
  rootClassName,
  toggleThemeButtonClassName,
  toggleThemeButtonContainerClassName,
} from "./standalone.css";
import "./standalone.css";
import { useLayoutEffect, useState } from "react";
import { darkTheme, lightTheme } from "./shared/styles/theme/themes";

type StandaloneVariant = Exclude<VariantProps["variant"], "zerion">;
type StandaloneTheme = "dark" | "light";

const variant: StandaloneVariant =
  import.meta.env.VITE_APP_VARIANT ?? "default";

// Standalone configuration: a valid env var wins over the query param;
// otherwise the query param, otherwise the default.
// `?variant=dashboard|classic&theme=dark|light&borrow=true|false`
const query = new URLSearchParams(window.location.search);
const booleans = new Map([
  ["true", true],
  ["false", false],
]);
const layouts = new Map([
  ["dashboard", true],
  ["classic", false],
]);
const themes: ReadonlyArray<StandaloneTheme> = ["dark", "light"];
const parseTheme = (value: string | null | undefined) =>
  themes.find((theme) => theme === value);

const dashboardVariant: boolean =
  booleans.get(import.meta.env.VITE_FORCE_DASHBOARD ?? "") ??
  layouts.get(query.get("variant") ?? "") ??
  true;
const borrowEnabled: boolean =
  booleans.get(import.meta.env.VITE_FORCE_BORROW ?? "") ??
  booleans.get(query.get("borrow") ?? "") ??
  true;
const initialTheme: StandaloneTheme =
  parseTheme(import.meta.env.VITE_APP_THEME) ??
  parseTheme(query.get("theme")) ??
  "dark";

const StandaloneApp = () => {
  const [themeVariant, setThemeVariant] = useState(initialTheme);

  useLayoutEffect(() => {
    document.body.className = rootClassName({
      theme: themeVariant,
      variant,
    });
  }, [themeVariant]);

  const toggleTheme = () =>
    setThemeVariant(themeVariant === "dark" ? "light" : "dark");

  const props: SKAppProps = {
    variant,
    borrowEnabled,
    dashboardVariant,
    theme: themeVariant === "dark" ? darkTheme : lightTheme,
    apiKey: import.meta.env.VITE_API_KEY,
    onMountAnimationComplete: () => console.log("mount animation complete!"),
    ...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
      tracking: { trackEvent: console.log, trackPageView: console.log },
    }),
  };

  return (
    <>
      <div className={toggleThemeButtonContainerClassName}>
        <button
          className={toggleThemeButtonClassName({ theme: themeVariant })}
          onClick={toggleTheme}
          type="button"
        >
          Toggle Theme
        </button>
      </div>

      <SKApp {...props} />
    </>
  );
};

const enableMocking = async () => {
  if (import.meta.env.VITE_ENABLE_MSW_MOCK !== "true") return;

  const { worker } = await import("./worker");

  return worker.start();
};

enableMocking()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <StandaloneApp />
    );
  })
  .catch((e) => {
    console.error(e);
  });
