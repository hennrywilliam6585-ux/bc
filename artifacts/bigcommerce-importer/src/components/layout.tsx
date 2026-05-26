import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck } from "@workspace/api-client-react";
import { 
  Database, 
  LayoutDashboard, 
  UploadCloud, 
  FileSpreadsheet,
  Settings,
  CheckCircle2,
  AlertCircle,
  Timer,
  Trash2,
  LogOut
} from "lucide-react";

function useCountdown() {
  const [msLeft, setMsLeft] = useState<number | null>(null);
  const expiresAtRef = useRef<Date | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/session/status");
        if (!res.ok) return;
        const data = await res.json() as { active: boolean; expiresAt: string | null };
        if (data.active && data.expiresAt) {
          const newDate = new Date(data.expiresAt);
          // Only update ref if timestamp actually changed — prevents re-render loops
          if (!expiresAtRef.current || expiresAtRef.current.getTime() !== newDate.getTime()) {
            expiresAtRef.current = newDate;
            setMsLeft(Math.max(0, newDate.getTime() - Date.now()));
          }
        } else {
          expiresAtRef.current = null;
          setMsLeft(null);
        }
      } catch { /* ignore */ }
    };

    fetchStatus();
    const fetchInterval = setInterval(fetchStatus, 60_000);

    const tickInterval = setInterval(() => {
      if (expiresAtRef.current) {
        const left = expiresAtRef.current.getTime() - Date.now();
        setMsLeft(Math.max(0, left));
      }
    }, 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, []); // runs once on mount — no dependency loop

  return msLeft;
}

function formatCountdown(ms: number): { text: string; urgent: boolean } {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const urgent = ms < 60 * 60 * 1000; // under 1 hour
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = h > 0
    ? `${h}h ${pad(m)}m ${pad(s)}s`
    : `${pad(m)}m ${pad(s)}s`;
  return { text, urgent };
}

export function Layout({ children, onSignOut }: { children: React.ReactNode; onSignOut?: () => void }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const msLeft = useCountdown();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "New Import", href: "/import", icon: UploadCloud },
    { name: "Templates", href: "/templates", icon: FileSpreadsheet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const countdown = msLeft !== null ? formatCountdown(msLeft) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border text-sidebar-foreground">
          <Database className="w-5 h-5 mr-3 text-sidebar-primary" />
          <span className="font-semibold text-lg tracking-tight">BC Importer</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                <item.icon className={`mr-3 h-4 w-4 ${isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-3 space-y-3">
          {/* Countdown timer */}
          <div className={`rounded-lg px-3 py-2.5 border ${countdown?.urgent ? 'border-destructive/50 bg-destructive/10' : 'border-sidebar-border bg-sidebar-accent/30'}`}>
            <div className="flex items-center gap-2 mb-1">
              {countdown?.urgent ? (
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              ) : (
                <Timer className="w-3.5 h-3.5 text-sidebar-foreground/50" />
              )}
              <span className="text-xs text-sidebar-foreground/60 font-medium">Auto-wipe in</span>
            </div>
            <div className={`text-sm font-mono font-semibold tabular-nums ${countdown?.urgent ? 'text-destructive' : 'text-sidebar-foreground'}`}>
              {countdown ? countdown.text : <span className="text-sidebar-foreground/30 text-xs">Not started</span>}
            </div>
          </div>

          {/* API status */}
          <div className="flex items-center text-xs text-sidebar-foreground/60 px-1">
            {health?.status === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 mr-2 text-destructive" />
            )}
            API Status: {health?.status || "Checking..."}
          </div>

          {/* Sign out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4 text-sidebar-foreground/50" />
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            {navigation.find(n => n.href === location)?.name || "Job Detail"}
          </h1>
          <div className="flex items-center gap-4">
             {/* Optional header actions */}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}