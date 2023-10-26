import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme, lightTheme } from "./styles";
import { config } from "./config";
import "./standalone.styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SKApp
    apiKey={config.apiKey}
    // connectKitForceTheme="darkMode"
    connectKitForceTheme="lightMode"
    theme={lightTheme}
    {...(import.meta.env.VITE_ANALYTICS_LOGGING === "true" && {
      tracking: { trackEvent: console.log, trackPageView: console.log },
    })}
  />
);
