import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Membership, CheckIn, insertUserSchema } from "@shared/schema";
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
  QrCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
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

  // Queries
  const { data: members, isLoading: membersLoading } = useQuery<(User & {membership?: Membership})[]>({
    queryKey: ["/api/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/members");
      return res.json();
    },
  });

  const { data: checkIns = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/check-ins/today");
      return res.json();
    },
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

  const { data: dashboardSummary = {} } = useQuery({
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

        <Tabs defaultValue="overview" className="space-y-6">
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
            <TabsTrigger value="analytics" className="flex-shrink-0">Analytics</TabsTrigger>
            <TabsTrigger value="card-reader" className="flex-shrink-0">Card Reader</TabsTrigger>
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
                  {checkIns.length > 0 ? (
                    <div className="space-y-3">
                      {checkIns.slice(0, 5).map((checkIn: any) => (
                        <div key={checkIn.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">
                              {checkIn.user?.firstName && checkIn.user?.lastName 
                                ? `${checkIn.user.firstName} ${checkIn.user.lastName}`
                                : checkIn.user?.email || `Member #${checkIn.userId}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {checkIn.timestamp ? format(new Date(checkIn.timestamp), "h:mm a") : "N/A"}
                              {checkIn.location && ` • ${checkIn.location}`}
                            </p>
                          </div>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.visitsByDate || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => format(new Date(value), "MMM dd")}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), "EEEE, MMMM do")}
                    />
                    <Bar dataKey="visits" fill="#4a6741" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Hourly Distribution */}
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-4">Peak Hours Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.hourlyData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}:00`}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="visits" fill="#6b8e5a" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Card Reader Tab */}
          <TabsContent value="card-reader" className="space-y-6">
            <AdminCardReaderSplash />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}