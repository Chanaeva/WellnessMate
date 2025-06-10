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
  const [membershipId, setMembershipId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dailyQRCode, setDailyQRCode] = useState<string>("");
  const [qrCodeDate, setQrCodeDate] = useState<string>("");
  const itemsPerPage = 10;
  const { toast } = useToast();

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

  // Fetch dashboard summary
  const { data: summary } = useQuery({
    queryKey: ["/api/admin/dashboard-summary"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch visit analytics
  const { data: analytics } = useQuery({
    queryKey: ["/api/admin/visit-analytics", selectedPeriod],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch peak hours data
  const { data: peakHours } = useQuery({
    queryKey: ["/api/admin/peak-hours"],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch members data
  const { data: members, isLoading: membersLoading } = useQuery<(User & {membership?: Membership})[]>({
    queryKey: ["/api/admin/members"],
  });

  // Fetch check-ins data
  const { data: checkInsData, isLoading: checkInsLoading } = useQuery<{data: CheckIn[], total: number, page: number, limit: number}>({
    queryKey: ["/api/admin/check-ins", currentPage, itemsPerPage],
  });

  // Add new member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: NewMemberFormData) => {
      const response = await apiRequest("POST", "/api/admin/create-member", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Added",
        description: "New member has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsAddMemberOpen(false);
      newMemberForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create member",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmitNewMember = (data: NewMemberFormData) => {
    addMemberMutation.mutate(data);
  };

  // Filter and search members
  const filteredMembers = members?.filter(member => {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const email = member.email.toLowerCase();
    const membershipId = member.membership?.membershipId?.toLowerCase() || '';
    const searchLower = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(searchLower) || 
                         email.includes(searchLower) || 
                         membershipId.includes(searchLower);

    const matchesStatus = statusFilter === "all" || 
                         member.membership?.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Pagination for members
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleManualCheckIn = async () => {
    if (!membershipId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a membership ID",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/admin/manual-checkin", {
        membershipId: membershipId.trim(),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: `Check-in successful for ${result.user.firstName} ${result.user.lastName}`,
        });
        setMembershipId("");
        // Refresh check-ins data
        queryClient.invalidateQueries({ queryKey: ["/api/admin/check-ins"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] });
      }
    } catch (error: any) {
      toast({
        title: "Check-in Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Generate daily QR codes for all members
  const generateDailyQRCode = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (qrCodeDate === today && dailyQRCode) {
      return; // Already generated for today
    }

    try {
      // Create a general facility QR code that can be used for walk-ins or general purposes
      const qrData = JSON.stringify({
        type: "facility_checkin",
        date: today,
        facility: "wolf_mother_wellness",
        description: "Wolf Mother Wellness Daily Check-in"
      });
      
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setDailyQRCode(qrCodeDataURL);
      setQrCodeDate(today);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate daily QR code",
        variant: "destructive",
      });
    }
  };

  // Generate QR code on component mount
  useEffect(() => {
    generateDailyQRCode();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadQRCode = () => {
    if (!dailyQRCode) return;
    
    const link = document.createElement('a');
    link.href = dailyQRCode;
    link.download = `wolf-mother-daily-qr-${qrCodeDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: "QR code downloaded successfully",
    });
  };

  const printQRCode = () => {
    if (!dailyQRCode) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Wolf Mother Wellness - Daily Check-in QR Code</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px; 
              }
              .qr-container { 
                margin: 20px auto; 
                display: inline-block; 
              }
              h1 { color: #333; margin-bottom: 10px; }
              h2 { color: #666; margin-bottom: 20px; }
              .date { font-size: 18px; margin: 10px 0; }
              .instructions { 
                margin-top: 20px; 
                font-size: 14px; 
                color: #666; 
                max-width: 400px; 
                margin-left: auto; 
                margin-right: auto; 
              }
            </style>
          </head>
          <body>
            <h1>Wolf Mother Wellness</h1>
            <h2>Daily Check-in QR Code</h2>
            <div class="date">Date: ${format(new Date(), "MMMM dd, yyyy")}</div>
            <div class="qr-container">
              <img src="${dailyQRCode}" alt="Daily Check-in QR Code" />
            </div>
            <div class="instructions">
              Scan this QR code to check in to Wolf Mother Wellness.<br/>
              This code is valid for today only.
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Prepare chart data
  const visitData = analytics?.visitsByDate || [];
  const peakHoursData = peakHours?.hourlyData || [];

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600">Wolf Mother Wellness Management</p>
          </div>

          {/* Main Tabbed Interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="checkins">Check-ins</TabsTrigger>
              <TabsTrigger value="packages">Packages</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary?.todayVisits || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Visits</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary?.monthlyVisits || 0}</div>
                    {summary?.growth?.visits && (
                      <Badge variant={summary.growth.visits >= 0 ? "default" : "destructive"} className="mt-1">
                        {summary.growth.visits >= 0 ? "+" : ""}{summary.growth.visits}%
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary?.activeMembers || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{peakHours?.peakHour || "N/A"}</div>
                    <p className="text-xs text-muted-foreground">
                      {peakHours?.peakVisits || 0} visits
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily QR Code */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <QrCode className="h-5 w-5 mr-2" />
                      Daily Check-in QR Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    {dailyQRCode ? (
                      <>
                        <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300 inline-block">
                          <img 
                            src={dailyQRCode} 
                            alt="Daily Check-in QR Code" 
                            className="w-48 h-48 mx-auto"
                          />
                        </div>
                        <div className="text-sm text-gray-600">
                          Valid for: {format(new Date(), "MMMM dd, yyyy")}
                        </div>
                        <div className="flex justify-center space-x-2">
                          <Button onClick={downloadQRCode} variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button onClick={printQRCode} variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                          This is a facility QR code. Members will use their individual daily QR codes 
                          (generated from their member dashboard) for seamless check-in.
                        </p>
                      </>
                    ) : (
                      <div className="py-8">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-500">Generating daily QR code...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Manual Check-in */}
                <Card>
                  <CardHeader>
                    <CardTitle>Manual Check-in</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Enter Membership ID (e.g., WM-001)"
                        value={membershipId}
                        onChange={(e) => setMembershipId(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleManualCheckIn}>
                        Check In
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Manually check in a member by entering their membership ID.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Member Management</h2>
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add New Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Member</DialogTitle>
                    </DialogHeader>
                    <Form {...newMemberForm}>
                      <form onSubmit={newMemberForm.handleSubmit(onSubmitNewMember)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={newMemberForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={newMemberForm.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={newMemberForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newMemberForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newMemberForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newMemberForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newMemberForm.control}
                          name="planType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Membership Plan</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a plan" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="basic">Basic Plan</SelectItem>
                                  <SelectItem value="premium">Premium Plan</SelectItem>
                                  <SelectItem value="vip">VIP Plan</SelectItem>
                                  <SelectItem value="daily">Daily Pass</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddMemberOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addMemberMutation.isPending}>
                            {addMemberMutation.isPending ? "Creating..." : "Create Member"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search and Filter */}
              <div className="flex space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search members by name, email, or membership ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Members Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Members ({filteredMembers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {membersLoading ? (
                    <div className="text-center py-8">Loading members...</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Name</th>
                              <th className="text-left py-2">Email</th>
                              <th className="text-left py-2">Membership ID</th>
                              <th className="text-left py-2">Plan</th>
                              <th className="text-left py-2">Status</th>
                              <th className="text-left py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedMembers.map((member) => (
                              <tr key={member.id} className="border-b">
                                <td className="py-2">{member.firstName} {member.lastName}</td>
                                <td className="py-2">{member.email}</td>
                                <td className="py-2">{member.membership?.membershipId || 'N/A'}</td>
                                <td className="py-2">
                                  <Badge variant="outline">
                                    {member.membership?.planType || 'No Plan'}
                                  </Badge>
                                </td>
                                <td className="py-2">
                                  <Badge 
                                    variant={member.membership?.status === 'active' ? 'default' : 'secondary'}
                                  >
                                    {member.membership?.status || 'Inactive'}
                                  </Badge>
                                </td>
                                <td className="py-2">
                                  <div className="flex space-x-2">
                                    <Button size="sm" variant="outline">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="outline">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Check-ins Tab */}
            <TabsContent value="checkins" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Check-in Management</h2>
                <Button onClick={() => window.open('/staff-checkin', '_blank')}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Staff Check-in Scanner
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                </CardHeader>
                <CardContent>
                  {checkInsLoading ? (
                    <div className="text-center py-8">Loading check-ins...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Time</th>
                            <th className="text-left py-2">Member</th>
                            <th className="text-left py-2">Membership ID</th>
                            <th className="text-left py-2">Method</th>
                            <th className="text-left py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkInsData?.data?.map((checkIn: any) => (
                            <tr key={checkIn.id} className="border-b">
                              <td className="py-2">
                                {format(new Date(checkIn.checkInTime), "MMM dd, yyyy HH:mm")}
                              </td>
                              <td className="py-2">
                                {checkIn.user ? `${checkIn.user.firstName} ${checkIn.user.lastName}` : 'Unknown'}
                              </td>
                              <td className="py-2">{checkIn.membershipId}</td>
                              <td className="py-2">
                                <Badge variant="outline">
                                  {checkIn.method === 'qr' ? 'QR Code' : 'Manual'}
                                </Badge>
                              </td>
                              <td className="py-2">
                                <Badge variant="default">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={visitData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="visits" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Peak Hours Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={peakHoursData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="visits" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}