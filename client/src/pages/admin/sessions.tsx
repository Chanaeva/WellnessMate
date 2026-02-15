import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SessionConfig, DayPassHours } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Sun, Moon, Users, Clock, Save, Loader2, Ticket, Calendar } from "lucide-react";

export default function AdminSessions() {
  const { toast } = useToast();
  const [editingSession, setEditingSession] = useState<'morning' | 'evening' | null>(null);
  const [editingDayPass, setEditingDayPass] = useState(false);
  const [formData, setFormData] = useState<{
    startTime: string;
    endTime: string;
    capacity: number;
    isEnabled: boolean;
    bookingGraceMinutes: number;
    availableDays: number[];
  }>({ startTime: '', endTime: '', capacity: 20, isEnabled: true, bookingGraceMinutes: 60, availableDays: [0, 1, 2, 3, 4, 5, 6] });

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [dayPassFormData, setDayPassFormData] = useState<{
    startTime: string;
    endTime: string;
    isEnabled: boolean;
  }>({ startTime: '10:00 AM', endTime: '5:00 PM', isEnabled: true });

  const { data: sessions, isLoading } = useQuery<SessionConfig[]>({
    queryKey: ["/api/admin/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/sessions");
      return res.json();
    },
  });

  const { data: dayPassHours, isLoading: isDayPassLoading } = useQuery<DayPassHours>({
    queryKey: ["/api/day-pass-hours"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/day-pass-hours");
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

  const updateDayPassMutation = useMutation({
    mutationFn: async (data: { startTime: string; endTime: string; isEnabled: boolean }) => {
      const res = await apiRequest("PUT", "/api/admin/day-pass-hours", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/day-pass-hours"] });
      toast({
        title: "Day Pass Hours Updated",
        description: "Day pass hours have been saved successfully.",
      });
      setEditingDayPass(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update day pass hours",
        variant: "destructive",
      });
    },
  });

  const morningSession = sessions?.find(s => s.sessionType === 'morning');
  const eveningSession = sessions?.find(s => s.sessionType === 'evening');

  const startEditing = (session: SessionConfig | null, sessionType: 'morning' | 'evening') => {
    setEditingSession(sessionType);
    if (session) {
      setFormData({
        startTime: session.startTime,
        endTime: session.endTime,
        capacity: session.capacity,
        isEnabled: session.isEnabled,
        bookingGraceMinutes: session.bookingGraceMinutes ?? 60,
        availableDays: session.availableDays ?? [0, 1, 2, 3, 4, 5, 6],
      });
    } else {
      setFormData({
        startTime: sessionType === 'morning' ? '7:00 AM' : '4:00 PM',
        endTime: sessionType === 'morning' ? '12:00 PM' : '9:00 PM',
        capacity: 20,
        isEnabled: true,
        bookingGraceMinutes: 60,
        availableDays: [0, 1, 2, 3, 4, 5, 6],
      });
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day].sort()
    }));
  };

  const formatAvailableDays = (days: number[] | null | undefined) => {
    if (!days || days.length === 0) return 'No days selected';
    if (days.length === 7) return 'Every day';
    if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays only';
    if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6])) return 'Weekends only';
    return days.map(d => DAY_LABELS[d]).join(', ');
  };

  const startEditingDayPass = () => {
    if (dayPassHours) {
      setDayPassFormData({
        startTime: dayPassHours.startTime,
        endTime: dayPassHours.endTime,
        isEnabled: dayPassHours.isEnabled,
      });
    }
    setEditingDayPass(true);
  };

  const handleSave = () => {
    if (!editingSession) return;
    if (formData.availableDays.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one available day must be selected.",
        variant: "destructive",
      });
      return;
    }
    updateSessionMutation.mutate({
      sessionType: editingSession,
      data: formData,
    });
  };

  const handleSaveDayPass = () => {
    updateDayPassMutation.mutate(dayPassFormData);
  };

  const handleCancel = () => {
    setEditingSession(null);
  };

  const handleCancelDayPass = () => {
    setEditingDayPass(false);
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="morning-grace">Booking Allowance (minutes)</Label>
                    <Input
                      id="morning-grace"
                      type="number"
                      value={formData.bookingGraceMinutes}
                      onChange={(e) => setFormData({ ...formData, bookingGraceMinutes: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      How long after session starts members can still book
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${
                          formData.availableDays.includes(index)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        <Checkbox
                          checked={formData.availableDays.includes(index)}
                          onCheckedChange={() => toggleDay(index)}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which days of the week this session is available for booking
                  </p>
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
                {morningSession ? (
                  <>
                    <div className="flex items-center gap-2 text-lg">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">{morningSession.startTime}</span>
                      <span className="text-muted-foreground">to</span>
                      <span className="font-semibold">{morningSession.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>Capacity: <strong>{morningSession.capacity}</strong> members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span>Booking Allowance: <strong>{morningSession.bookingGraceMinutes ?? 60}</strong> min after start</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span>Available: <strong>{formatAvailableDays(morningSession.availableDays)}</strong></span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Session not configured yet. Click below to set up.
                  </p>
                )}
                <Button 
                  variant="outline" 
                  className="w-full min-h-[44px] touch-manipulation"
                  onClick={() => startEditing(morningSession || null, 'morning')}
                >
                  {morningSession ? 'Edit Session' : 'Configure Session'}
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="evening-grace">Booking Allowance (minutes)</Label>
                    <Input
                      id="evening-grace"
                      type="number"
                      value={formData.bookingGraceMinutes}
                      onChange={(e) => setFormData({ ...formData, bookingGraceMinutes: parseInt(e.target.value) || 0 })}
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      How long after session starts members can still book
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${
                          formData.availableDays.includes(index)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        <Checkbox
                          checked={formData.availableDays.includes(index)}
                          onCheckedChange={() => toggleDay(index)}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which days of the week this session is available for booking
                  </p>
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
                {eveningSession ? (
                  <>
                    <div className="flex items-center gap-2 text-lg">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">{eveningSession.startTime}</span>
                      <span className="text-muted-foreground">to</span>
                      <span className="font-semibold">{eveningSession.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>Capacity: <strong>{eveningSession.capacity}</strong> members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span>Booking Allowance: <strong>{eveningSession.bookingGraceMinutes ?? 60}</strong> min after start</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span>Available: <strong>{formatAvailableDays(eveningSession.availableDays)}</strong></span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Session not configured yet. Click below to set up.
                  </p>
                )}
                <Button 
                  variant="outline" 
                  className="w-full min-h-[44px] touch-manipulation"
                  onClick={() => startEditing(eveningSession || null, 'evening')}
                >
                  {eveningSession ? 'Edit Session' : 'Configure Session'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day Pass Hours Card */}
      <Card className={!dayPassHours?.isEnabled ? "opacity-60" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Ticket className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Day Pass Hours</CardTitle>
                <CardDescription>Open hours for day pass visitors (no booking required)</CardDescription>
              </div>
            </div>
            <Badge variant={dayPassHours?.isEnabled ? "default" : "secondary"}>
              {dayPassHours?.isEnabled ? "Active" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingDayPass ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daypass-start">Start Time</Label>
                  <Input
                    id="daypass-start"
                    value={dayPassFormData.startTime}
                    onChange={(e) => setDayPassFormData({ ...dayPassFormData, startTime: e.target.value })}
                    placeholder="10:00 AM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daypass-end">End Time</Label>
                  <Input
                    id="daypass-end"
                    value={dayPassFormData.endTime}
                    onChange={(e) => setDayPassFormData({ ...dayPassFormData, endTime: e.target.value })}
                    placeholder="5:00 PM"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="daypass-enabled">Day Pass Hours Enabled</Label>
                <Switch
                  id="daypass-enabled"
                  checked={dayPassFormData.isEnabled}
                  onCheckedChange={(checked) => setDayPassFormData({ ...dayPassFormData, isEnabled: checked })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveDayPass} disabled={updateDayPassMutation.isPending}>
                  {updateDayPassMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancelDayPass}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">{dayPassHours?.startTime || '10:00 AM'}</span>
                <span className="text-muted-foreground">to</span>
                <span className="font-semibold">{dayPassHours?.endTime || '5:00 PM'}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Day pass holders can check in during these hours without needing to book a session.
              </p>
              <Button 
                variant="outline" 
                className="w-full min-h-[44px] touch-manipulation"
                onClick={startEditingDayPass}
              >
                Edit Day Pass Hours
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Sessions Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>Sessions help organize facility capacity throughout the day.</p>
          <p>Members can optionally book sessions to reserve their spot.</p>
          <p>Disabled sessions will not be shown to members.</p>
          <p className="font-medium text-foreground">Members can check in anytime during operating hours.</p>
          <p className="font-medium text-foreground">Day pass users can check in during day pass hours without booking.</p>
        </CardContent>
      </Card>
    </div>
  );
}
