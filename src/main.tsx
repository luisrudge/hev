import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { Landing } from "./Landing.tsx";

if (location.pathname !== "/") {
  history.replaceState(null, "", "/#live");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
