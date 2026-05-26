import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useValidateCredentials, useGetStoreSettings, getListImportJobsQueryKey, getGetImportStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Upload, Users, Box, ShoppingCart, Loader2, FileText, Zap, Store, ChevronDown } from "lucide-react";

const BC_ORDER_STATUSES = [
  { id: 1,  label: "Pending" },
  { id: 7,  label: "Awaiting Payment" },
  { id: 11, label: "Awaiting Fulfillment" },
  { id: 2,  label: "Shipped" },
  { id: 3,  label: "Partially Shipped" },
  { id: 5,  label: "Cancelled" },
  { id: 8,  label: "Awaiting Pickup" },
  { id: 10, label: "Completed" },
  { id: 9,  label: "Awaiting Shipment" },
];

type ImportType = "customers" | "products" | "orders";

const IMPORT_TYPES: { value: ImportType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "customers", label: "Customers", icon: Users, description: "Create customer accounts" },
  { value: "products", label: "Products", icon: Box, description: "Add products to your catalog" },
  { value: "orders", label: "Orders", icon: ShoppingCart, description: "Import orders with customer + product mapping" },
];

export default function ImportWizard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [importType, setImportType] = useState<ImportType>("customers");
  const [delayMs, setDelayMs] = useState(500);
  const [autoCompleteStatusId, setAutoCompleteStatusId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: savedSettings, isLoading: settingsLoading } = useGetStoreSettings();
  const usingSaved = savedSettings?.configured === true && !showManualOverride;

  const validateMutation = useValidateCredentials();
  const isValidated = usingSaved || validateMutation.data?.valid === true;

  const handleValidate = () => {
    if (!storeHash || !accessToken) return;
    validateMutation.mutate({ data: { storeHash, accessToken, clientId: clientId || null } });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      setFile(dropped);
      setUploadError(null);
    } else {
      setUploadError("Please upload a CSV file");
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileInputKey((k) => k + 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file || !isValidated) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      if (usingSaved) {
        formData.append("useSavedCredentials", "true");
      } else {
        formData.append("storeHash", storeHash);
        formData.append("accessToken", accessToken);
      }
      formData.append("delayMs", String(delayMs));
      if (importType === "orders" && autoCompleteStatusId !== null) {
        formData.append("autoCompleteStatusId", String(autoCompleteStatusId));
      }
      formData.append("file", file);

      const currentUserId = sessionStorage.getItem("bc_importer_user") ?? "";
      const res = await fetch(`/api/imports/${importType}`, {
        method: "POST",
        headers: { "X-User-Id": currentUserId },
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `HTTP ${res.status}`;
        try { const parsed = JSON.parse(errText); errMsg = parsed.error ?? parsed.message ?? errMsg; } catch { if (errText) errMsg = errText; }
        throw new Error(errMsg);
      }
      const rawBody = await res.text();
      const job = (rawBody.trim() ? JSON.parse(rawBody) : {}) as { id: string };
      queryClient.invalidateQueries({ queryKey: getListImportJobsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetImportStatsQueryKey() });
      clearFile();
      setLocation(`/jobs/${job.id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const canStart = isValidated && file && !uploading;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">New Import</h2>
        <p className="text-muted-foreground mt-1">Configure your BigCommerce credentials and upload a CSV to begin</p>
      </div>

      {/* Step 1: Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
            Store Credentials
          </CardTitle>
          <CardDescription>
            {settingsLoading ? "Loading saved credentials…" : usingSaved ? "Using your saved store credentials" : "Enter your BigCommerce API credentials"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : usingSaved ? (
            /* Saved credentials banner */
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Store className="w-4 h-4 text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {savedSettings?.storeName ?? "Store"} — Connected
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {savedSettings?.storeHash} · {savedSettings?.accessTokenMasked}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setShowManualOverride(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                Use different credentials instead
              </button>
            </div>
          ) : (
            /* Manual entry form */
            <div className="space-y-4">
              {savedSettings?.configured && (
                <button
                  type="button"
                  onClick={() => { setShowManualOverride(false); validateMutation.reset(); }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  ← Use saved credentials ({savedSettings.storeName})
                </button>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="storeHash">Store Hash <span className="text-destructive">*</span></Label>
                  <Input
                    id="storeHash"
                    data-testid="input-store-hash"
                    placeholder="abc123xyz"
                    value={storeHash}
                    onChange={(e) => { setStoreHash(e.target.value); validateMutation.reset(); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accessToken">Access Token <span className="text-destructive">*</span></Label>
                  <Input
                    id="accessToken"
                    data-testid="input-access-token"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={accessToken}
                    onChange={(e) => { setAccessToken(e.target.value); validateMutation.reset(); }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="clientId"
                  data-testid="input-client-id"
                  placeholder="Optional"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  data-testid="button-validate"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={!storeHash || !accessToken || validateMutation.isPending}
                >
                  {validateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating...</>
                  ) : "Validate Credentials"}
                </Button>
                {validateMutation.data && (
                  validateMutation.data.valid ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {validateMutation.data.storeName ?? "Connected"}
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {validateMutation.data.error ?? "Invalid credentials"}
                    </Badge>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Import Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
            Import Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {IMPORT_TYPES.map((t) => (
              <button
                key={t.value}
                data-testid={`import-type-${t.value}`}
                onClick={() => setImportType(t.value)}
                className={`flex flex-col items-start p-4 rounded-lg border text-left transition-all ${
                  importType === t.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                }`}
              >
                <t.icon className={`w-5 h-5 mb-2 ${importType === t.value ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-medium text-sm">{t.label}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{t.description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
            Upload CSV
          </CardTitle>
          <CardDescription>
            Need a template?{" "}
            <a href={`/api/templates/${importType}`} download className="text-primary underline underline-offset-2">
              Download {importType} template
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            data-testid="upload-dropzone"
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input key={fileInputKey} ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="text-xs text-muted-foreground underline hover:text-destructive mt-1"
                >
                  Remove — click to choose a different file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="font-medium">Drop CSV here or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports .csv files up to 20MB</p>
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-sm text-destructive mt-2 flex items-center gap-1">
              <XCircle className="w-4 h-4" /> {uploadError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Auto-complete status (orders only) */}
      {importType === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
              Auto-Complete Order Status
              <Badge variant="outline" className="text-xs font-normal ml-1">Optional</Badge>
            </CardTitle>
            <CardDescription>
              Automatically set every imported order to a specific status the moment the import finishes — no extra steps needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              <button
                onClick={() => setAutoCompleteStatusId(null)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center text-xs transition-all gap-1 ${
                  autoCompleteStatusId === null
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                }`}
              >
                <span className="text-base">—</span>
                <span className="font-medium">No auto-set</span>
              </button>
              {BC_ORDER_STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAutoCompleteStatusId(s.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center text-xs transition-all gap-1 ${
                    autoCompleteStatusId === s.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${autoCompleteStatusId === s.id ? "text-primary" : ""}`} />
                  <span className="font-medium leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
            {autoCompleteStatusId !== null && (
              <p className="text-xs text-primary mt-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3" />
                All imported orders will be automatically set to <strong>{BC_ORDER_STATUSES.find(s => s.id === autoCompleteStatusId)?.label}</strong> when the import completes
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Delay + Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{importType === "orders" ? "5" : "4"}</span>
            Rate Limiting
          </CardTitle>
          <CardDescription>Control the delay between API calls to avoid rate limit errors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Delay between API calls</Label>
              <span className="font-mono text-sm font-medium">{delayMs}ms</span>
            </div>
            <Slider
              data-testid="slider-delay"
              min={0}
              max={5000}
              step={100}
              value={[delayMs]}
              onValueChange={([v]) => setDelayMs(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0ms (fastest)</span>
              <span className="text-yellow-500">500ms (recommended)</span>
              <span>5000ms (safest)</span>
            </div>
          </div>
          <Button
            data-testid="button-start-import"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canStart}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting Import...</>
            ) : (
              <>Start Import</>
            )}
          </Button>
          {!isValidated && (
            <p className="text-xs text-muted-foreground text-center">Validate credentials to enable import</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
