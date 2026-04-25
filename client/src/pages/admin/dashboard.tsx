import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Membership, insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Calendar, 
  UserPlus, 
  Search, 
  Eye, 
  Edit, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  DollarSign,
  Monitor,
  ExternalLink,
  QrCode,
  Sunrise,
  Sunset,
  ClipboardList,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { formatTimeCST } from "@/lib/timezone";
import Header from "@/components/layout/header";
import { Link } from "wouter";
import PackagesManagement from "./packages";
import AdminMembers from "./members";
import AdminNotifications from "./notifications";
import LandingPageManagement from "./landing-page";
import AdminStaffManagement from "./staff-management";
import AdminInventory from "./inventory";
import AdminSessions from "./sessions";
import AdminSessionBookings from "./session-bookings";
import StaffItems from "@/pages/staff-items";
import AdminDayPasses from "./day-passes";
import AdminCheckIns from "./check-ins";
import AdminCardReaderSplash from "./card-reader-splash";
import AdminGiftCards from "./gift-cards";
import AdminChecklists from "./checklists";
import AdminConfiguration from "./configuration";

// Form schema for adding new member
const newMemberSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm password"),
  planType: z.enum(['basic', 'premium', 'vip', 'daily']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type NewMemberFormData = z.infer<typeof newMemberSchema>;

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Queries
  const { data: members, isLoading: membersLoading } = useQuery<(User & {membership?: Membership})[]>({
    queryKey: ["/api/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/members");
      return res.json();
    },
  });

  const { data: recentVisits } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/admin/unified-check-ins?page=1&pageSize=5&period=today"],
    staleTime: 60 * 1000,
  });

  const { data: analytics = {} } = useQuery({
    queryKey: ["/api/admin/visit-analytics", selectedPeriod],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/visit-analytics?period=${selectedPeriod}`);
      return res.json();
    },
  });

  const { data: peakHours = {} } = useQuery({
    queryKey: ["/api/admin/peak-hours"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/peak-hours");
      return res.json();
    },
  });

  type DashboardSummary = {
    todayVisits: number;
    monthlyVisits: number;
    activeMembers: number;
    frozenMembers: number;
    expiredMembers: number;
    inactiveMembers: number;
    totalMemberships: number;
    newMembers: number;
    growth: { visits: number };
  };
  const { data: dashboardSummary } = useQuery<DashboardSummary>({
    queryKey: ["/api/admin/dashboard-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard-summary");
      return res.json();
    },
  });

  const { data: upcomingBookings = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/session-bookings", "upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiRequest("GET", `/api/admin/session-bookings?fromDate=${today}`);
      return res.json();
    },
  });

  const { data: checklistSummary } = useQuery<{
    opening: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    closing: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
    hourly: { total: number; completed: number; hasRun: boolean; isComplete: boolean };
  }>({
    queryKey: ["/api/admin/checklist-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/checklist-summary");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Form for adding new member
  const newMemberForm = useForm<NewMemberFormData>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      planType: "basic",
      role: "member",
    },
  });

  // Mutation for adding new member
  const addMemberMutation = useMutation({
    mutationFn: async (data: NewMemberFormData) => {
      const { confirmPassword, planType, ...userData } = data;
      
      // Create user first
      const userRes = await apiRequest("POST", "/api/register", userData);
      const user = await userRes.json();
      
      // Create membership
      const membershipData = {
        userId: user.id,
        planType,
        status: "active" as const,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      };
      
      await apiRequest("POST", "/api/memberships", membershipData);
      return user;
    },
    onSuccess: () => {
      toast({
        title: "Member Added",
        description: "New member has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setIsAddMemberOpen(false);
      newMemberForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitNewMember = (data: NewMemberFormData) => {
    addMemberMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your wellness center operations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto gap-1 px-1 whitespace-nowrap">
            <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="members" className="flex-shrink-0">Members</TabsTrigger>
            <TabsTrigger value="check-ins" className="flex-shrink-0">Check-ins</TabsTrigger>
            <TabsTrigger value="day-passes" className="flex-shrink-0">Day Passes</TabsTrigger>
            <TabsTrigger value="staff" className="flex-shrink-0">Staff</TabsTrigger>
            <TabsTrigger value="sessions" className="flex-shrink-0">Sessions</TabsTrigger>
            <TabsTrigger value="item-checkout" className="flex-shrink-0">Item Checkout</TabsTrigger>
            <TabsTrigger value="packages" className="flex-shrink-0">Packages</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-shrink-0">Inventory</TabsTrigger>
            <TabsTrigger value="landing-page" className="flex-shrink-0">Landing Page</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-shrink-0">Notifications</TabsTrigger>
            <TabsTrigger value="gift-cards" className="flex-shrink-0">Gift Cards</TabsTrigger>
            <TabsTrigger value="checklists" className="flex-shrink-0">Checklists</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0">Analytics</TabsTrigger>
            <TabsTrigger value="card-reader" className="flex-shrink-0">Card Reader</TabsTrigger>
            <TabsTrigger value="configuration" className="flex-shrink-0">Configuration</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Kiosk Section */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Monitor className="h-5 w-5 mr-2" />
                    iPad Kiosk Interface
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Self-service check-in for members
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="bg-muted rounded-lg p-4 mb-4">
                      <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Open this on your iPad at the front desk
                      </p>
                    </div>
                    <Link href="/kiosk" target="_blank">
                      <Button className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Launch Kiosk Mode
                      </Button>
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Members search by name or email to check in</p>
                    <p>• Automatic session welcome messages</p>
                    <p>• Self-service member registration</p>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Check-ins */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentVisits && recentVisits.data.length > 0 ? (
                    <div className="space-y-3">
                      {recentVisits.data.slice(0, 5).map((entry: any, idx: number) => (
                        <div key={`${entry.entry_type}-${entry.id}-${idx}`} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">
                              {entry.first_name} {entry.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {entry.ts ? formatTimeCST(entry.ts) : "N/A"}
                            </p>
                          </div>
                          {entry.entry_type === "guest" ? (
                            <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                              Guest
                            </Badge>
                          ) : (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Member
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No check-ins today yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Session Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Upcoming Session Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingBookings.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingBookings.slice(0, 5).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">
                              {booking.user?.firstName && booking.user?.lastName 
                                ? `${booking.user.firstName} ${booking.user.lastName}`
                                : booking.user?.email || `Member #${booking.userId}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {booking.bookingDate ? format(new Date(booking.bookingDate + 'T12:00:00'), "MMM d, yyyy") : "N/A"}
                            </p>
                          </div>
                          <Badge variant={booking.sessionType === 'morning' ? 'default' : 'secondary'}>
                            {booking.sessionType === 'morning' ? 'Morning' : 'Evening'}
                          </Badge>
                        </div>
                      ))}
                      {upcomingBookings.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          +{upcomingBookings.length - 5} more bookings
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No upcoming session bookings.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

              {/* Shift Checklists Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Shift Checklists
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Today's operational checklist status</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                      { key: "opening", label: "Opening", icon: Sunrise, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
                      { key: "closing", label: "Closing", icon: Sunset, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
                      { key: "hourly",  label: "Hourly",  icon: Clock,   color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                    ] as const).map(({ key, label, icon: Icon, color, bg }) => {
                      const s = checklistSummary?.[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveTab("checklists")}
                          className={`rounded-xl p-4 text-left border transition-all hover:shadow-md ${bg} border-border`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${color}`} />
                              <span className="font-semibold text-sm">{label}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {s ? (
                            <>
                              <div className="text-2xl font-bold mb-1">
                                {s.completed}/{s.total}
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${s.isComplete ? "bg-green-500" : "bg-primary"}`}
                                  style={{ width: s.total > 0 ? `${Math.round((s.completed / s.total) * 100)}%` : "0%" }}
                                />
                              </div>
                              {s.isComplete ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : s.hasRun ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs">
                                  <CircleDashed className="h-3 w-3 mr-1" />
                                  Not Started
                                </Badge>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">Loading...</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
          </TabsContent>

          {/* Checklists Tab */}
          <TabsContent value="checklists" className="space-y-6">
            <AdminChecklists />
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <AdminMembers />
          </TabsContent>

          {/* Check-ins Tab */}
          <TabsContent value="check-ins" className="space-y-6">
            <AdminCheckIns />
          </TabsContent>

          {/* Day Passes Tab */}
          <TabsContent value="day-passes" className="space-y-6">
            <AdminDayPasses />
          </TabsContent>

          {/* Staff Management Tab */}
          <TabsContent value="staff" className="space-y-6">
            <AdminStaffManagement />
          </TabsContent>

          {/* Sessions Tab - Combined Sessions & Bookings */}
          <TabsContent value="sessions" className="space-y-8">
            <AdminSessionBookings />
            <AdminSessions />
          </TabsContent>

          {/* Item Checkout Tab */}
          <TabsContent value="item-checkout" className="space-y-6">
            <StaffItems embedded />
          </TabsContent>

          {/* Package Management Tab */}
          <TabsContent value="packages" className="space-y-6">
            <PackagesManagement />
          </TabsContent>

          {/* Inventory Management Tab */}
          <TabsContent value="inventory" className="space-y-6">
            <AdminInventory />
          </TabsContent>

          {/* Landing Page Management Tab */}
          <TabsContent value="landing-page" className="space-y-6">
            <LandingPageManagement />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <AdminNotifications />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold">Analytics & Reports</h2>

            {/* Member Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Member Breakdown
                </CardTitle>
                <p className="text-sm text-muted-foreground">Current membership counts by status</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Active</p>
                      <p className="text-2xl font-bold">{dashboardSummary?.activeMembers ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                      <Clock className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Frozen</p>
                      <p className="text-2xl font-bold">{dashboardSummary?.frozenMembers ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg shrink-0">
                      <Calendar className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expired</p>
                      <p className="text-2xl font-bold">{dashboardSummary?.expiredMembers ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                      <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Inactive</p>
                      <p className="text-2xl font-bold">{dashboardSummary?.inactiveMembers ?? 0}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Total memberships: <span className="font-medium">{dashboardSummary?.totalMemberships ?? 0}</span>
                  {' · '}New this month: <span className="font-medium">{dashboardSummary?.newMembers ?? 0}</span>
                </p>
              </CardContent>
            </Card>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                      <p className="text-2xl font-bold">{analytics.totalVisits ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Daily Average</p>
                      <p className="text-2xl font-bold">{analytics.averageDaily ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Peak Hour</p>
                      <p className="text-2xl font-bold">{(peakHours as any).peakHour ?? '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Users className="h-5 w-5 text-purple-700" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Peak Visits</p>
                      <p className="text-2xl font-bold">{(peakHours as any).peakVisits ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Visit Analytics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Visit Analytics</CardTitle>
                <div className="flex space-x-2">
                  <Button
                    variant={selectedPeriod === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod("week")}
                  >
                    Week
                  </Button>
                  <Button
                    variant={selectedPeriod === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod("month")}
                  >
                    Month
                  </Button>
                  <Button
                    variant={selectedPeriod === "year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod("year")}
                  >
                    Year
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(analytics.visitsByDate || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-lg font-medium">No visit data for this period</p>
                    <p className="text-sm">Check-ins will appear here as members visit</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.visitsByDate || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => format(new Date(value + 'T12:00:00'), "MMM dd")}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value + 'T12:00:00'), "EEEE, MMMM do")}
                      />
                      <Bar dataKey="visits" fill="#4a6741" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Peak Hours Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">Based on the last 7 days of check-ins</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={(peakHours as any).hourlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        if (value === 0) return '12AM';
                        if (value < 12) return `${value}AM`;
                        if (value === 12) return '12PM';
                        return `${value - 12}PM`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip 
                      labelFormatter={(value) => {
                        const h = Number(value);
                        if (h === 0) return '12:00 AM';
                        if (h < 12) return `${h}:00 AM`;
                        if (h === 12) return '12:00 PM';
                        return `${h - 12}:00 PM`;
                      }}
                    />
                    <Bar dataKey="visits" fill="#6b8e5a" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gift Cards Tab */}
          <TabsContent value="gift-cards" className="space-y-6">
            <AdminGiftCards />
          </TabsContent>

          {/* Card Reader Tab */}
          <TabsContent value="card-reader" className="space-y-6">
            <AdminCardReaderSplash />
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6">
            <AdminConfiguration />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}