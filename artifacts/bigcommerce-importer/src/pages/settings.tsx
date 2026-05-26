import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStoreSettings,
  useSaveStoreSettings,
  useListWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  getGetStoreSettingsQueryKey,
  getListWebhooksQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";

const WEBHOOK_SCOPES = [
  { value: "store/order/created", label: "Order Created" },
  { value: "store/order/statusUpdated", label: "Order Status Updated" },
  { value: "store/product/created", label: "Product Created" },
  { value: "store/product/updated", label: "Product Updated" },
  { value: "store/customer/created", label: "Customer Created" },
  { value: "store/customer/updated", label: "Customer Updated" },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Store settings
  const { data: settings, isLoading: settingsLoading } = useGetStoreSettings();
  const saveSettingsMutation = useSaveStoreSettings();

  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Webhooks
  const { data: webhookData, isLoading: webhooksLoading, refetch: refetchWebhooks } = useListWebhooks({
    query: { enabled: settings?.configured === true, queryKey: getListWebhooksQueryKey() },
  });
  const createWebhookMutation = useCreateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();

  const [newScope, setNewScope] = useState(WEBHOOK_SCOPES[0].value);
  const [newDestination, setNewDestination] = useState("");
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  const handleSaveSettings = async () => {
    if (!storeHash.trim() || !accessToken.trim()) {
      toast({ title: "Missing fields", description: "Store hash and access token are required.", variant: "destructive" });
      return;
    }
    try {
      await saveSettingsMutation.mutateAsync({
        data: {
          storeHash: storeHash.trim(),
          accessToken: accessToken.trim(),
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListWebhooksQueryKey() });
      toast({ title: "Settings saved", description: "Store credentials validated and saved." });
      setEditMode(false);
      setAccessToken("");
      setClientSecret("");
    } catch {
      toast({ title: "Save failed", description: "Could not validate or save credentials.", variant: "destructive" });
    }
  };

  const handleAddWebhook = async () => {
    if (!newDestination.trim()) {
      toast({ title: "Missing destination URL", variant: "destructive" });
      return;
    }
    try {
      await createWebhookMutation.mutateAsync({ data: { scope: newScope, destination: newDestination.trim() } });
      await queryClient.invalidateQueries({ queryKey: getListWebhooksQueryKey() });
      toast({ title: "Webhook registered", description: `${newScope} → ${newDestination}` });
      setNewDestination("");
      setShowAddWebhook(false);
    } catch {
      toast({ title: "Failed to create webhook", variant: "destructive" });
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    try {
      await deleteWebhookMutation.mutateAsync({ webhookId: id });
      await queryClient.invalidateQueries({ queryKey: getListWebhooksQueryKey() });
      toast({ title: "Webhook deleted" });
    } catch {
      toast({ title: "Failed to delete webhook", variant: "destructive" });
    }
  };

  const isConfigured = settings?.configured === true;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your connected BigCommerce store</p>
      </div>

      {/* Store Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Connected BigCommerce Store</CardTitle>
                <CardDescription>Store credentials used for all import jobs</CardDescription>
              </div>
            </div>
            {isConfigured && (
              <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            )}
            {!settingsLoading && !isConfigured && (
              <Badge variant="outline" className="text-muted-foreground gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Not configured
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading settings...
            </div>
          ) : isConfigured && !editMode ? (
            /* Connected state — read-only display */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Row 1: Store Hash + Access Token */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Store Hash</p>
                  <p className="text-sm font-mono bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">{settings.storeHash}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Access Token</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono bg-muted/40 rounded px-2.5 py-1.5 border border-border/50 flex-1">
                      {settings.accessTokenMasked ?? "—"}
                    </p>
                    <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs shrink-0">
                      Saved
                    </Badge>
                  </div>
                </div>
                {/* Row 2: Client ID + Client Secret */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Client ID</p>
                  <p className="text-sm font-mono bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">{settings.clientId ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Client Secret</p>
                  {settings.clientSecretConfigured ? (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono bg-muted/40 rounded px-2.5 py-1.5 border border-border/50 flex-1">••••••••••••••••</p>
                      <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs shrink-0">
                        Saved
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm bg-muted/40 rounded px-2.5 py-1.5 border border-border/50 text-muted-foreground">Not configured</p>
                  )}
                </div>
                {/* Row 3: Store Name + Store URL */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Store Name</p>
                  <p className="text-sm bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">{settings.storeName ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Store URL</p>
                  {settings.storeUrl ? (
                    <a
                      href={settings.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm flex items-center gap-1.5 text-primary hover:underline bg-muted/40 rounded px-2.5 py-1.5 border border-border/50"
                    >
                      <LinkIcon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{settings.storeUrl}</span>
                    </a>
                  ) : (
                    <p className="text-sm bg-muted/40 rounded px-2.5 py-1.5 border border-border/50">—</p>
                  )}
                </div>
              </div>
              {settings.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date(settings.updatedAt).toLocaleString()}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => { setEditMode(true); setStoreHash(settings.storeHash ?? ""); }}>
                Update Credentials
              </Button>
            </div>
          ) : (
            /* Edit / unconfigured form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeHash">Store Hash <span className="text-destructive">*</span></Label>
                  <Input
                    id="storeHash"
                    placeholder="e.g. gqbioat4ak"
                    value={storeHash}
                    onChange={e => setStoreHash(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Found in your BigCommerce store URL</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="accessToken"
                      type={showToken ? "text" : "password"}
                      placeholder="Your API access token"
                      value={accessToken}
                      onChange={e => setAccessToken(e.target.value)}
                      className="font-mono pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowToken(v => !v)}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Requires store/order/*, store/product/*, store/customer/* scopes</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <Input
                    id="clientId"
                    placeholder="Your app client ID"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">From your BigCommerce app registration</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">Client Secret <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Input
                      id="clientSecret"
                      type={showSecret ? "text" : "password"}
                      placeholder="Your app client secret"
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      className="font-mono pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret(v => !v)}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Used to verify incoming webhook payload signatures</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveSettings}
                  disabled={saveSettingsMutation.isPending}
                >
                  {saveSettingsMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating...</>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
                {editMode && (
                  <Button variant="ghost" onClick={() => { setEditMode(false); setStoreHash(""); setAccessToken(""); setClientId(""); setClientSecret(""); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Webhook className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">BigCommerce Webhooks</CardTitle>
                <CardDescription>Receive real-time events from your store</CardDescription>
              </div>
            </div>
            {isConfigured && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchWebhooks()} disabled={webhooksLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${webhooksLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setShowAddWebhook(v => !v)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Webhook
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isConfigured ? (
            <p className="text-sm text-muted-foreground py-2">
              Configure your store credentials above to manage webhooks.
            </p>
          ) : (
            <>
              {/* Add webhook form */}
              {showAddWebhook && (
                <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
                  <p className="text-sm font-medium">Register New Webhook</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="scope" className="text-xs">Event Scope</Label>
                      <select
                        id="scope"
                        value={newScope}
                        onChange={e => setNewScope(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {WEBHOOK_SCOPES.map(s => (
                          <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="destination" className="text-xs">Destination URL</Label>
                      <Input
                        id="destination"
                        placeholder="https://your-app.example.com/webhooks/bc"
                        value={newDestination}
                        onChange={e => setNewDestination(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddWebhook} disabled={createWebhookMutation.isPending}>
                      {createWebhookMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Register"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddWebhook(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Webhook list */}
              {webhooksLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading webhooks...
                </div>
              ) : !webhookData?.webhooks || webhookData.webhooks.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <Webhook className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No webhooks registered</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Webhook" to receive real-time store events</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Scope</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Destination</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="px-4 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookData.webhooks.map((wh, i) => (
                        <>
                          {i > 0 && <tr key={`sep-${wh.id}`}><td colSpan={4}><Separator /></td></tr>}
                          <tr key={wh.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded text-primary">{wh.scope}</code>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs font-mono truncate max-w-xs">{wh.destination}</td>
                            <td className="px-4 py-3">
                              {wh.is_active ? (
                                <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Inactive
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteWebhook(wh.id)}
                                disabled={deleteWebhookMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
