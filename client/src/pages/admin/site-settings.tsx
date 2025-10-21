import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, Clock, Copyright, Instagram, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SiteSettings {
  hoursOfOperation: string;
  hoursMembers: string;
  hoursDayPass: string;
  address: string;
  addressLine2: string;
  copyrightYear: string;
  instagramHandle: string;
}

export default function SiteSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SiteSettings>({
    hoursOfOperation: '',
    hoursMembers: '',
    hoursDayPass: '',
    address: '',
    addressLine2: '',
    copyrightYear: '',
    instagramHandle: '',
  });

  const { isLoading } = useQuery({
    queryKey: ['/api/admin/site-settings'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/site-settings");
      const data = await res.json();
      
      const settingsObj: SiteSettings = {
        hoursOfOperation: data.find((s: any) => s.key === 'hoursOfOperation')?.value || '6:00 AM - 10:00 PM',
        hoursMembers: data.find((s: any) => s.key === 'hoursMembers')?.value || '6:00 AM - 9:00 AM',
        hoursDayPass: data.find((s: any) => s.key === 'hoursDayPass')?.value || '9:00 AM - 10:00 PM',
        address: data.find((s: any) => s.key === 'address')?.value || '2124 E Admiral',
        addressLine2: data.find((s: any) => s.key === 'addressLine2')?.value || 'Kendall Whitter Neighborhood\nTulsa, OK',
        copyrightYear: data.find((s: any) => s.key === 'copyrightYear')?.value || '2025',
        instagramHandle: data.find((s: any) => s.key === 'instagramHandle')?.value || 'wolfmothertulsa',
      };
      
      setSettings(settingsObj);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SiteSettings) => {
      const res = await apiRequest("POST", "/api/admin/site-settings", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/site-settings'] });
      toast({
        title: "Settings Saved",
        description: "Your changes have been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Settings</h2>
          <p className="text-muted-foreground">Manage footer information and contact details</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Hours of Operation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hours of Operation
              </CardTitle>
              <CardDescription>
                Set the hours displayed on the landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hoursOfOperation">Daily Hours</Label>
                <Input
                  id="hoursOfOperation"
                  value={settings.hoursOfOperation}
                  onChange={(e) => setSettings({ ...settings, hoursOfOperation: e.target.value })}
                  placeholder="6:00 AM - 10:00 PM"
                  data-testid="input-hours-operation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hoursMembers">Members Only Access</Label>
                <Input
                  id="hoursMembers"
                  value={settings.hoursMembers}
                  onChange={(e) => setSettings({ ...settings, hoursMembers: e.target.value })}
                  placeholder="6:00 AM - 9:00 AM"
                  data-testid="input-hours-members"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hoursDayPass">Day Pass Access</Label>
                <Input
                  id="hoursDayPass"
                  value={settings.hoursDayPass}
                  onChange={(e) => setSettings({ ...settings, hoursDayPass: e.target.value })}
                  placeholder="9:00 AM - 10:00 PM"
                  data-testid="input-hours-daypass"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Address
              </CardTitle>
              <CardDescription>
                Physical location displayed on the landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="2124 E Admiral"
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">City, State</Label>
                <Textarea
                  id="addressLine2"
                  value={settings.addressLine2}
                  onChange={(e) => setSettings({ ...settings, addressLine2: e.target.value })}
                  placeholder="Kendall Whitter Neighborhood&#10;Tulsa, OK"
                  rows={2}
                  data-testid="input-address-line2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Copyright & Social */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copyright className="h-5 w-5" />
                Copyright & Social Media
              </CardTitle>
              <CardDescription>
                Footer copyright year and social media links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="copyrightYear">Copyright Year</Label>
                <Input
                  id="copyrightYear"
                  value={settings.copyrightYear}
                  onChange={(e) => setSettings({ ...settings, copyrightYear: e.target.value })}
                  placeholder="2025"
                  data-testid="input-copyright-year"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramHandle" className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram Handle
                </Label>
                <Input
                  id="instagramHandle"
                  value={settings.instagramHandle}
                  onChange={(e) => setSettings({ ...settings, instagramHandle: e.target.value })}
                  placeholder="wolfmothertulsa"
                  data-testid="input-instagram"
                />
                <p className="text-sm text-muted-foreground">
                  Enter without @: {settings.instagramHandle && `@${settings.instagramHandle}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
