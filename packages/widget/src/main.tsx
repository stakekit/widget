import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { lightTheme } from "./styles/theme/themes";
import "./standalone.styles.css";

const enableMocking = async () => {
  if (import.meta.env.VITE_ENABLE_MSW_MOCK !== "true") return;

  const { worker } = await import("./worker");

  return worker.start();
};

enableMocking()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <SKApp
        theme={lightTheme}
        apiKey={import.meta.env.VITE_API_KEY}
        onMountAnimationComplete={() =>
          console.log("mount animation complete!")
        }
        wagmi={{
          forceWalletConnectOnly:
            import.meta.env.VITE_FORCE_WALLET_CONNECT_ONLY === "true",
        }}
        {...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
          tracking: { trackEvent: console.log, trackPageView: console.log },
        })}
        dashboardVariant={import.meta.env.VITE_FORCE_DASHBOARD === "true"}
        variant={import.meta.env.VITE_APP_VARIANT ?? "default"}
        // hideAccountAndChainSelector
      />
    );
  })
  .catch((e) => {
    console.error(e);
  });
