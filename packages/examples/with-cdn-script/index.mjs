import {
  lightTheme,
  renderSKWidget,
} from "https://unpkg.com/@stakekit/widget@0.0.249/dist/bundle/index.bundle.js";

const rootElement = document.getElementById("widget-container");

const shadowRoot = rootElement.attachShadow({ mode: "closed" });
const shadowHead = document.createElement("head");
const shadowBody = document.createElement("body");

shadowRoot.appendChild(shadowHead);
shadowRoot.appendChild(shadowBody);

const link = document.createElement("link");
link.rel = "stylesheet";
link.href =
  "https://unpkg.com/@stakekit/widget@0.0.249/dist/bundle/index.bundle.css";

shadowHead.appendChild(link);
document.head.appendChild(link.cloneNode());

const shadowContainer = document.createElement("div");
shadowContainer.style.all = "initial";

shadowBody.appendChild(shadowContainer);

renderSKWidget({
  container: shadowContainer,
  theme: lightTheme,
  apiKey: "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
  portalContainer: shadowContainer,
  dashboardVariant: true,
});
