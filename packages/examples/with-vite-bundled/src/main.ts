import "./style.css";
import "@stakekit/widget/style.css";
import { darkTheme, renderSKWidget } from "@stakekit/widget/bundle";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("Missing #app container");

renderSKWidget({
  container,
  apiKey: import.meta.env.VITE_API_KEY,
  theme: darkTheme,
});
