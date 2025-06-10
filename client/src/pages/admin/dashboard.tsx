import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Membership, CheckIn, insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  QrCode,
  CheckCircle,
  Download,
  Printer,
  DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import Header from "@/components/layout/header";
import QRCode from "qrcode";
import PackagesManagement from "./packages";
import AdminMembers from "./members";

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
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
    queryKey: ["/api/analytics", selectedPeriod],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/analytics?period=${selectedPeriod}`);
      return res.json();
    },
  });

  const { data: peakHours = {} } = useQuery({
    queryKey: ["/api/analytics/peak-hours"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/analytics/peak-hours");
      return res.json();
    },
  });

  const { data: dashboardSummary = {} } = useQuery({
    queryKey: ["/api/dashboard-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard-summary");
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

  // Generate QR code for today's check-in
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const qrData = `checkin:${today}`;
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: "#4a6741",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };

    generateQRCode();
  }, []);

  const downloadQRCode = () => {
    if (qrCodeDataUrl) {
      const link = document.createElement("a");
      link.href = qrCodeDataUrl;
      link.download = `checkin-qr-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.click();
    }
  };

  const printQRCode = () => {
    if (qrCodeDataUrl) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Daily Check-in QR Code</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  text-align: center; 
                  padding: 20px; 
                }
                h1 { color: #4a6741; }
                .date { 
                  font-size: 18px; 
                  margin: 10px 0; 
                  color: #666; 
                }
                img { margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1>Wolf Mother Wellness</h1>
              <h2>Daily Check-in QR Code</h2>
              <div class="date">${format(new Date(), "EEEE, MMMM do, yyyy")}</div>
              <img src="${qrCodeDataUrl}" alt="Check-in QR Code" />
              <p>Scan this code to check in to the facility</p>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{members?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardSummary.activeMembers || 0} active memberships
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{checkIns.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardSummary.todayVisits || 0} check-ins today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Visits</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardSummary.monthlyVisits || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardSummary.growth >= 0 ? '+' : ''}{dashboardSummary.growth || 0}% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{peakHours.peakHour || '--'}</div>
                  <p className="text-xs text-muted-foreground">
                    {peakHours.peakVisits || 0} visits avg
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily QR Code Section */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <QrCode className="h-5 w-5 mr-2" />
                    Today's Check-in QR Code
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), "EEEE, MMMM do, yyyy")}
                  </p>
                </CardHeader>
                <CardContent className="text-center">
                  {qrCodeDataUrl ? (
                    <div className="space-y-4">
                      <img
                        src={qrCodeDataUrl}
                        alt="Daily Check-in QR Code"
                        className="mx-auto rounded-lg border"
                      />
                      <div className="flex justify-center space-x-2">
                        <Button variant="outline" size="sm" onClick={downloadQRCode}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button variant="outline" size="sm" onClick={printQRCode}>
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Generating QR code...</p>
                    </div>
                  )}
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
                      {checkIns.slice(0, 5).map((checkIn) => (
                        <div key={checkIn.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">Member #{checkIn.userId}</p>
                            <p className="text-sm text-muted-foreground">
                              {checkIn.timestamp ? format(new Date(checkIn.timestamp), "h:mm a") : "N/A"}
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
            </div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <AdminMembers />
          </TabsContent>

          {/* Package Management Tab */}
          <TabsContent value="packages" className="space-y-6">
            <PackagesManagement />
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
        </Tabs>
      </main>
    </div>
  );
}