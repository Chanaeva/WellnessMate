import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SessionConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sun, Moon, Users, Clock, Save, Loader2 } from "lucide-react";

export default function AdminSessions() {
  const { toast } = useToast();
  const [editingSession, setEditingSession] = useState<'morning' | 'evening' | null>(null);
  const [formData, setFormData] = useState<{
    startTime: string;
    endTime: string;
    capacity: number;
    isEnabled: boolean;
  }>({ startTime: '', endTime: '', capacity: 20, isEnabled: true });

  const { data: sessions, isLoading } = useQuery<SessionConfig[]>({
    queryKey: ["/api/admin/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/sessions");
      return res.json();
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionType, data }: { sessionType: 'morning' | 'evening', data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/sessions/${sessionType}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Session Updated",
        description: "Session configuration has been saved successfully.",
      });
      setEditingSession(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update session",
        variant: "destructive",
      });
    },
  });

  const morningSession = sessions?.find(s => s.sessionType === 'morning');
  const eveningSession = sessions?.find(s => s.sessionType === 'evening');

  const startEditing = (session: SessionConfig) => {
    setEditingSession(session.sessionType as 'morning' | 'evening');
    setFormData({
      startTime: session.startTime,
      endTime: session.endTime,
      capacity: session.capacity,
      isEnabled: session.isEnabled,
    });
  };

  const handleSave = () => {
    if (!editingSession) return;
    updateSessionMutation.mutate({
      sessionType: editingSession,
      data: formData,
    });
  };

  const handleCancel = () => {
    setEditingSession(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Session Management</h2>
        <p className="text-muted-foreground">
          Configure morning and evening session times and capacity for member bookings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Morning Session Card */}
        <Card className={!morningSession?.isEnabled ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Sun className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle>Morning Session</CardTitle>
                  <CardDescription>First session of the day</CardDescription>
                </div>
              </div>
              <Badge variant={morningSession?.isEnabled ? "default" : "secondary"}>
                {morningSession?.isEnabled ? "Active" : "Disabled"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingSession === 'morning' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="morning-start">Start Time</Label>
                    <Input
                      id="morning-start"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      placeholder="7:00 AM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="morning-end">End Time</Label>
                    <Input
                      id="morning-end"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      placeholder="12:00 PM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="morning-capacity">Capacity (max members)</Label>
                  <Input
                    id="morning-capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                    min={1}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="morning-enabled">Session Enabled</Label>
                  <Switch
                    id="morning-enabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={updateSessionMutation.isPending}>
                    {updateSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">{morningSession?.startTime}</span>
                  <span className="text-muted-foreground">to</span>
                  <span className="font-semibold">{morningSession?.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Capacity: <strong>{morningSession?.capacity}</strong> members</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => morningSession && startEditing(morningSession)}
                >
                  Edit Session
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Evening Session Card */}
        <Card className={!eveningSession?.isEnabled ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle>Evening Session</CardTitle>
                  <CardDescription>Second session of the day</CardDescription>
                </div>
              </div>
              <Badge variant={eveningSession?.isEnabled ? "default" : "secondary"}>
                {eveningSession?.isEnabled ? "Active" : "Disabled"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingSession === 'evening' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="evening-start">Start Time</Label>
                    <Input
                      id="evening-start"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      placeholder="4:00 PM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="evening-end">End Time</Label>
                    <Input
                      id="evening-end"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      placeholder="9:00 PM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evening-capacity">Capacity (max members)</Label>
                  <Input
                    id="evening-capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                    min={1}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="evening-enabled">Session Enabled</Label>
                  <Switch
                    id="evening-enabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={updateSessionMutation.isPending}>
                    {updateSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">{eveningSession?.startTime}</span>
                  <span className="text-muted-foreground">to</span>
                  <span className="font-semibold">{eveningSession?.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Capacity: <strong>{eveningSession?.capacity}</strong> members</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => eveningSession && startEditing(eveningSession)}
                >
                  Edit Session
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How Session Booking Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>Members can book one session per day from their dashboard.</p>
          <p>Each session has a maximum capacity to ensure a quality experience.</p>
          <p>Disabled sessions will not be available for booking.</p>
          <p>Members must have a booking to check in during session hours.</p>
        </CardContent>
      </Card>
    </div>
  );
}
