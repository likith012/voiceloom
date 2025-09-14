import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Local Tailwind/DaisyUI baseline
import "./index.css";
// Bring in design tokens only (avoid duplicate Tailwind layers)
import "./styles/globals.css";
import { registerSW } from 'virtual:pwa-register';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: register service worker and auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Simple approach: reload to get the latest version
    // You can replace this with a toast/snackbar to let the user choose
    updateSW(true);
  },
  onOfflineReady() {
    // Optional: show a small notice that the app is ready to work offline
    // No-op to keep UI clean
  },
});
