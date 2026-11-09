import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Planner } from "@/components/planner";
import "@/styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <main>
        <Planner />
      </main>
    </StrictMode>,
  );
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/planner/sw.js").catch(() => {});
}
