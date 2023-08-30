import ReactDOM from "react-dom/client";
import { SKApp } from "./App";
import { darkTheme } from "./styles";
import { config } from "./config";
import "./standalone.styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <SKApp
    apiKey={config.apiKey}
    connectKitForceTheme="darkMode"
    theme={darkTheme}
  />
);
