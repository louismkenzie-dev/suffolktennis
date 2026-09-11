import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// The installed app precaches its shell, so a parent tapping an email link
// after a deploy was served the OLD shell — whose route table might not know
// the page the email points at — and saw our 404. The plugin's default
// script only registers the worker; this one also reloads the page the moment
// the new worker takes control, so the stale shell lasts a second, not until
// the parent happens to close every tab.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
