import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { initDataThemeFromStorage } from "./lib/theme";
import { OfflineRoot } from "./offline/OfflineRoot";
import { SwUpdateBanner } from "./components/SwUpdateBanner";
import { registerPwaServiceWorker } from "./registerPwa";
import { SessionProvider } from "./state/SessionContext";

initDataThemeFromStorage();
registerPwaServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <SwUpdateBanner />
          <OfflineRoot />
          <App />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
