import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ImportWizard from "@/pages/import-wizard";
import JobDetail from "@/pages/job-detail";
import Templates from "@/pages/templates";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

const SESSION_KEY = "bc_importer_user";
const POLL_INTERVAL_MS = 60 * 1000;

const queryClient = new QueryClient();

function Router({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Layout onSignOut={onSignOut}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/import" component={ImportWizard} />
        <Route path="/jobs/:jobId" component={JobDetail} />
        <Route path="/templates" component={Templates} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY)
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const forceLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setLoggedInUser(null);
    queryClient.clear();
  };

  const checkSessionExpiry = async () => {
    try {
      const res = await fetch("/api/session/status");
      if (!res.ok) return;
      const data = await res.json() as { active: boolean; msRemaining: number | null };
      if (data.active && data.msRemaining !== null && data.msRemaining <= 0) {
        forceLogout();
      }
    } catch {
      // network hiccup — don't logout
    }
  };

  useEffect(() => {
    if (!loggedInUser) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    fetch("/api/session/start", { method: "POST" }).catch(() => {});

    checkSessionExpiry();
    pollRef.current = setInterval(checkSessionExpiry, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser]);

  const handleLogin = (userId: string) => {
    sessionStorage.setItem(SESSION_KEY, userId);
    setLoggedInUser(userId);
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        {loggedInUser ? (
          <QueryClientProvider client={queryClient}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router onSignOut={forceLogout} />
            </WouterRouter>
            <Toaster />
          </QueryClientProvider>
        ) : (
          <>
            <Login onLogin={handleLogin} />
            <Toaster />
          </>
        )}
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;