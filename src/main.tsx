import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme } from "./styles";
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
        connectKitForceTheme="darkMode"
        theme={darkTheme}
        apiKey={import.meta.env.VITE_API_KEY}
        referralCheck={import.meta.env.VITE_ENABLE_REFERRAL_CHECK === "true"}
        wagmi={{
          forceWalletConnectOnly:
            import.meta.env.VITE_FORCE_WALLET_CONNECT_ONLY === "true",
        }}
        {...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
          tracking: { trackEvent: console.log, trackPageView: console.log },
        })}
      />
    );
  })
  .catch((e) => {
    console.error(e);
  });
