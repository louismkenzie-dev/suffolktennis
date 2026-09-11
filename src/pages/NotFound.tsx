import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

// A route the running bundle does not know is, more often than not, a route
// a NEWER bundle does know: the installed app served its cached shell to a
// deep link (a report or ticket email) that arrived after a deploy. So before
// admitting a 404, ask the service worker for the latest version and reload
// once. If the page is still unknown after that, it really is missing.
const RETRY_KEY = "st-404-retry";

const useStaleShellRetry = (pathname: string) => {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    let alreadyTried = false;
    try { alreadyTried = sessionStorage.getItem(RETRY_KEY) === pathname; } catch { /* private mode */ }
    if (alreadyTried) return;

    setChecking(true);
    let cancelled = false;
    const reload = () => { if (!cancelled) window.location.reload(); };
    try { sessionStorage.setItem(RETRY_KEY, pathname); } catch { /* private mode */ }

    navigator.serviceWorker.getRegistration()
      .then((reg) => reg?.update())
      .catch(() => undefined)
      .finally(() => {
        // Give a freshly installed worker a moment to take control (which
        // itself triggers a reload); if nothing changes, reload anyway so the
        // browser re-fetches the shell from the network.
        window.setTimeout(reload, 1500);
      });
    return () => { cancelled = true; };
  }, [pathname]);

  return checking;
};

const NotFound = () => {
  const location = useLocation();
  const checking = useStaleShellRetry(location.pathname);

  useEffect(() => {
    if (!checking) console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, checking]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted" aria-busy>
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading the latest version…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
