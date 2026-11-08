"use client";
import { useEffect, useState } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaControls() {
  const [online, setOnline] = useState(true);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", prompt);
    // Production only: never let a development build poison the offline cache.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/planner/sw.js", { scope: "/planner/", updateViaCache: "none" })
        .catch(() =>
          setMessage("Offline installation is unavailable in this browser."),
        );
    }
    Promise.resolve().then(update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  async function installApp() {
    if (!install) return;
    try {
      await install.prompt();
      await install.userChoice;
      setInstall(null);
    } catch {
      setMessage("Use your browser menu to install this app.");
    }
  }
  return (
    <aside className="pwa-controls no-print">
      {!online && (
        <p className="notice" role="status">
          Offline: manual plans and estimates work. Photo analysis needs a
          connection. Unsaved photos are cleared on reload.
        </p>
      )}
      {install && (
        <button className="secondary" onClick={() => void installApp()}>
          Install Structure Planner
        </button>
      )}
      {message && <p>{message}</p>}
    </aside>
  );
}
