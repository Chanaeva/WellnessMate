import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Calendar, ShoppingBag, Bell, Save, RefreshCw, Database, Download, HardDrive } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SiteSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  updatedAt?: string;
}

interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SettingField({
  label,
  description,
  settingKey,
  currentValue,
  type = "text",
  placeholder,
  unit,
}: {
  label: string;
  description?: string;
  settingKey: string;
  currentValue: string;
  type?: string;
  placeholder?: string;
  unit?: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/config-settings", {
        key: settingKey,
        value: value,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${label} updated successfully.` });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config-settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save setting.", variant: "destructive" });
    },
  });

  const handleChange = (v: string) => {
    setValue(v);
    setIsDirty(v !== currentValue);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <Input
            type={type}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            className="w-40"
          />
          {unit && <span className="text-sm text-muted-foreground whitespace-nowrap">{unit}</span>}
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          variant={isDirty ? "default" : "outline"}
        >
          {saveMutation.isPending ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          <span className="ml-1">{saveMutation.isPending ? "Saving..." : "Save"}</span>
        </Button>
      </div>
    </div>
  );
}

function DatabaseBackups() {
  const { toast } = useToast();

  const { data: backups = [], isLoading, refetch } = useQuery<BackupFile[]>({
    queryKey: ["/api/admin/backups"],
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backup");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backup Created",
        description: `${data.filename} (${formatBytes(data.sizeBytes)}) saved to Object Storage.`,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Backup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-rose-600" />
              Database Backups
            </CardTitle>
            <CardDescription className="mt-1">
              Create a compressed snapshot of the production database and store it in Object Storage. Backups are kept indefinitely.
            </CardDescription>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="shrink-0"
          >
            {createMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating backup…
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 mr-2" />
                Create Backup Now
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading backups…</p>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No backups yet. Click "Create Backup Now" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(b.createdAt), "MMM d, yyyy 'at' h:mm a")} &middot; {formatBytes(b.sizeBytes)}
                  </p>
                </div>
                <a
                  href={b.downloadUrl}
                  download={b.name}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline" className="shrink-0 ml-3">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminConfiguration() {
  const { data: settings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/config-settings"],
    staleTime: 5 * 60 * 1000,
  });

  const getVal = (key: string, fallback = "") =>
    settings?.find((s) => s.key === key)?.value ?? fallback;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="h-9 w-9 text-slate-600" />
            Configuration
          </h1>
          <p className="text-slate-600">Manage system-wide settings for Wolf Mother Wellness</p>
        </div>

        {/* Membership Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Membership Settings
            </CardTitle>
            <CardDescription>
              Control membership purchase limits and behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingField
              label="Max Memberships Per Purchase"
              description="Maximum number of memberships a single user can buy in one transaction at the kiosk."
              settingKey="maxMembershipsPerPurchase"
              currentValue={getVal("maxMembershipsPerPurchase", "4")}
              type="number"
              placeholder="4"
              unit="memberships"
            />
          </CardContent>
        </Card>

        {/* Capacity & Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              Capacity & Sessions
            </CardTitle>
            <CardDescription>
              Control daily visitor capacity and waitlist behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingField
              label="Daily Space Capacity"
              description="Maximum number of people allowed in the facility at once. Used for waitlist tracking."
              settingKey="dailyCapacity"
              currentValue={getVal("dailyCapacity", "30")}
              type="number"
              placeholder="30"
              unit="people"
            />
            <SettingField
              label="Waitlist Auto-Notify Threshold"
              description="Send a notification to the next person on the waitlist when capacity drops to this number."
              settingKey="waitlistNotifyThreshold"
              currentValue={getVal("waitlistNotifyThreshold", "5")}
              type="number"
              placeholder="5"
              unit="spots remaining"
            />
          </CardContent>
        </Card>

        {/* Day Pass Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
              Day Pass Settings
            </CardTitle>
            <CardDescription>
              Configure day pass purchase limits and expiration defaults
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingField
              label="Max Day Passes Per Purchase"
              description="Maximum number of day pass bundles a member can buy at once."
              settingKey="maxDayPassesPerPurchase"
              currentValue={getVal("maxDayPassesPerPurchase", "5")}
              type="number"
              placeholder="5"
              unit="bundles"
            />
            <SettingField
              label="Default Day Pass Expiry (Days)"
              description="Default number of days a day pass bundle is valid after purchase, if no custom expiry is set on the package."
              settingKey="defaultDayPassExpiryDays"
              currentValue={getVal("defaultDayPassExpiryDays", "365")}
              type="number"
              placeholder="365"
              unit="days"
            />
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure system-wide notification and email defaults
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <SettingField
              label="Admin Alert Email"
              description="Email address that receives admin notifications (membership issues, payment failures, etc.)."
              settingKey="adminAlertEmail"
              currentValue={getVal("adminAlertEmail", "")}
              type="email"
              placeholder="admin@wolfmotherwellness.com"
            />
            <SettingField
              label="From Name (Email)"
              description="Display name used in outgoing emails from the system."
              settingKey="emailFromName"
              currentValue={getVal("emailFromName", "Wolf Mother Wellness")}
              placeholder="Wolf Mother Wellness"
            />
            <SettingField
              label="Session Reminder Lead Time"
              description="How many hours before a booked session to send the member a reminder email."
              settingKey="sessionReminderHours"
              currentValue={getVal("sessionReminderHours", "2")}
              type="number"
              placeholder="2"
              unit="hours before"
            />
          </CardContent>
        </Card>

        {/* Database Backups */}
        <DatabaseBackups />

        {/* All Raw Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              All Settings
              <Badge variant="secondary">{settings?.length ?? 0} keys</Badge>
            </CardTitle>
            <CardDescription>Raw view of all configuration keys stored in the database</CardDescription>
          </CardHeader>
          <CardContent>
            {!settings || settings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No settings configured yet.</p>
            ) : (
              <div className="space-y-2">
                {settings.map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div>
                      <code className="text-sm font-mono text-slate-700">{s.key}</code>
                      {s.description && (
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono text-xs shrink-0 ml-4">
                      {s.value}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
