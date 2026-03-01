import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SessionConfig, DayPassHours, Waitlist } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Sun, Moon, Users, Clock, Save, Loader2, Ticket, Calendar, Pencil, Trash2, UserPlus, ClipboardList, BellRing } from "lucide-react";

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

  // Waitlist state
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
  const [waitlistDate, setWaitlistDate] = useState(todayLocal);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState<number>(50);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({ name: '', email: '', phone: '', notes: '' });

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

  const { data: dailyCapacityData } = useQuery<{ dailyCapacity: number }>({
    queryKey: ["/api/settings/daily-capacity"],
    queryFn: async () => {
      const res = await fetch("/api/settings/daily-capacity");
      return res.json();
    },
  });

  const { data: waitlistEntries = [], isLoading: isWaitlistLoading } = useQuery<Waitlist[]>({
    queryKey: ["/api/admin/waitlist", waitlistDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/waitlist?date=${waitlistDate}`);
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

  const updateCapacityMutation = useMutation({
    mutationFn: async (dailyCapacity: number) => {
      const res = await apiRequest("PUT", "/api/admin/settings/daily-capacity", { dailyCapacity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/daily-capacity"] });
      toast({ title: "Capacity Updated", description: "Daily space capacity has been saved." });
      setEditingCapacity(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update capacity", variant: "destructive" });
    },
  });

  const addWaitlistMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/waitlist", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist", waitlistDate] });
      toast({ title: "Added", description: "Person added to the waitlist." });
      setShowAddForm(false);
      setAddFormData({ name: '', email: '', phone: '', notes: '' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add entry", variant: "destructive" });
    },
  });

  const updateWaitlistStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/waitlist/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist", waitlistDate] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteWaitlistMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/waitlist/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist", waitlistDate] });
      toast({ title: "Removed", description: "Entry removed from the waitlist." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove entry", variant: "destructive" });
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

  const startEditingCapacity = () => {
    setCapacityInput(dailyCapacityData?.dailyCapacity ?? 50);
    setEditingCapacity(true);
  };

  const handleAddWaitlist = () => {
    if (!addFormData.name.trim()) {
      toast({ title: "Name required", description: "Please enter the person's name.", variant: "destructive" });
      return;
    }
    addWaitlistMutation.mutate({ ...addFormData, date: waitlistDate, status: 'pending' });
  };

  const currentCapacity = dailyCapacityData?.dailyCapacity ?? 50;
  const spotsUsed = waitlistEntries.length;
  const spotsRemaining = Math.max(0, currentCapacity - spotsUsed);
  const isFull = spotsUsed >= currentCapacity;

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
                      How many minutes before session start members can book
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_LABELS.map((label, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Checkbox
                          id={`morning-day-${idx}`}
                          checked={formData.availableDays.includes(idx)}
                          onCheckedChange={() => toggleDay(idx)}
                        />
                        <Label htmlFor={`morning-day-${idx}`} className="cursor-pointer">{label}</Label>
                      </div>
                    ))}
                  </div>
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
                      <span>Capacity: <strong>{morningSession.capacity} members</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span>Booking allowance: <strong>{morningSession.bookingGraceMinutes ?? 60} min</strong></span>
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
                      How many minutes before session start members can book
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_LABELS.map((label, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Checkbox
                          id={`evening-day-${idx}`}
                          checked={formData.availableDays.includes(idx)}
                          onCheckedChange={() => toggleDay(idx)}
                        />
                        <Label htmlFor={`evening-day-${idx}`} className="cursor-pointer">{label}</Label>
                      </div>
                    ))}
                  </div>
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
                      <span>Capacity: <strong>{eveningSession.capacity} members</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span>Booking allowance: <strong>{eveningSession.bookingGraceMinutes ?? 60} min</strong></span>
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

      {/* Daily Capacity & Waitlist Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>Daily Capacity &amp; Waitlist</CardTitle>
              <CardDescription>Track space capacity and manage the daily waitlist</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Capacity setting */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Daily Space Capacity</span>
            </div>
            {editingCapacity ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-24 h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => updateCapacityMutation.mutate(capacityInput)}
                  disabled={updateCapacityMutation.isPending}
                >
                  {updateCapacityMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCapacity(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{currentCapacity}</span>
                <Button size="sm" variant="ghost" onClick={startEditingCapacity} className="h-7 w-7 p-0">
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Date selector */}
          <div className="flex items-center justify-between">
            <Label htmlFor="waitlist-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Viewing waitlist for:
            </Label>
            <Input
              id="waitlist-date"
              type="date"
              value={waitlistDate}
              onChange={(e) => setWaitlistDate(e.target.value)}
              className="w-44 h-8 text-sm"
            />
          </div>

          {/* Capacity summary */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${isFull ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'}`}>
            <span className="text-sm font-medium">
              {isFull ? 'Space is full for this day' : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`}
            </span>
            <Badge variant={isFull ? "destructive" : "default"} className={!isFull ? "bg-green-600" : ""}>
              {spotsUsed} / {currentCapacity} filled
            </Badge>
          </div>

          {/* Add to waitlist button / form */}
          {!showAddForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add to Waitlist
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Add person to waitlist for {waitlistDate}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    placeholder="Full name"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    placeholder="Phone number"
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="Email address"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="Any notes..."
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                  className="text-sm min-h-[60px] resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddWaitlist}
                  disabled={addWaitlistMutation.isPending}
                >
                  {addWaitlistMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Add to Waitlist
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setAddFormData({ name: '', email: '', phone: '', notes: '' }); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Waitlist entries */}
          <div className="space-y-2">
            {isWaitlistLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : waitlistEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No one on the waitlist for {waitlistDate === todayLocal ? 'today' : waitlistDate}.
              </p>
            ) : (
              waitlistEntries.map((entry, idx) => (
                <div key={entry.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-sm font-medium text-muted-foreground w-5 shrink-0 mt-0.5">{idx + 1}.</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      {(entry.email || entry.phone) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[entry.email, entry.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground italic truncate">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={entry.status === 'notified' ? 'default' : 'secondary'}
                      className={`text-xs ${entry.status === 'notified' ? 'bg-green-600' : 'bg-yellow-500 text-white'}`}
                    >
                      {entry.status === 'notified' ? 'Notified' : 'Pending'}
                    </Badge>
                    {entry.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Mark as notified"
                        onClick={() => updateWaitlistStatusMutation.mutate({ id: entry.id, status: 'notified' })}
                        disabled={updateWaitlistStatusMutation.isPending}
                      >
                        <BellRing className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove from waitlist"
                      onClick={() => deleteWaitlistMutation.mutate(entry.id)}
                      disabled={deleteWaitlistMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
