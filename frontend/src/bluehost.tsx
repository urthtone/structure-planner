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
