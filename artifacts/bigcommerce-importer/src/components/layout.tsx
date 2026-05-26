import { Link, useLocation } from "wouter";
import { useHealthCheck } from "@workspace/api-client-react";
import { 
  Database, 
  LayoutDashboard, 
  UploadCloud, 
  FileSpreadsheet,
  Settings,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "New Import", href: "/import", icon: UploadCloud },
    { name: "Templates", href: "/templates", icon: FileSpreadsheet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

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

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center text-xs text-sidebar-foreground/60">
            {health?.status === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 mr-2 text-destructive" />
            )}
            API Status: {health?.status || "Checking..."}
          </div>
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