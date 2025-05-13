import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CheckIn, User } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRScanner } from "@/components/ui/qr-scanner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  QrCode,
  Calendar
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

export default function AdminCheckIns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("today");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("list");
  const itemsPerPage = 10;

  // Fetch all check-ins with pagination
  const { data: checkInsData, isLoading } = useQuery<{
    data: CheckIn[],
    total: number,
    page: number,
    limit: number
  }>({
    queryKey: ["/api/admin/check-ins", currentPage, itemsPerPage],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch today's check-ins for quick view and chart
  const { data: todayCheckIns } = useQuery<CheckIn[]>({
    queryKey: ["/api/admin/check-ins/today"],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch members data for displaying names
  const { data: members } = useQuery<User[]>({
    queryKey: ["/api/admin/members"],
    enabled: !!user && user.role === 'admin',
  });

  // QR code check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: {userId: number, membershipId: string}) => {
      return await apiRequest("POST", "/api/check-in", { 
        userId: data.userId,
        membershipId: data.membershipId,
        location: "Main Entrance" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check-ins/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check-ins"] });
      toast({
        title: "Check-in successful!",
        description: "Member has been checked in.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle QR code scan
  const handleScan = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.membershipId && parsed.userId) {
        checkInMutation.mutate({
          userId: parsed.userId,
          membershipId: parsed.membershipId
        });
      } else {
        toast({
          title: "Invalid QR code",
          description: "The scanned QR code is missing required information.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Invalid QR code",
        description: "The scanned QR code is not valid.",
        variant: "destructive",
      });
    }
  };

  // Get member name by ID
  const getMemberName = (userId: number) => {
    const member = members?.find(m => m.id === userId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  // Filter check-ins
  const filteredCheckIns = checkInsData?.data.filter(checkIn => {
    const memberName = getMemberName(checkIn.userId).toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    
    return !searchQuery || memberName.includes(searchLower) || 
      checkIn.membershipId.toLowerCase().includes(searchLower);
  }) || [];

  // Generate chart data
  const generateChartData = () => {
    if (!todayCheckIns) return [];
    
    // For weekly data, get each day of the current week
    const today = new Date();
    const startDay = startOfWeek(today);
    const endDay = endOfWeek(today);
    
    const daysInWeek = eachDayOfInterval({ start: startDay, end: endDay });
    
    return daysInWeek.map(day => {
      const checkInsOnDay = todayCheckIns.filter(checkIn => {
        const checkInDate = new Date(checkIn.timestamp);
        return checkInDate.getDate() === day.getDate() &&
               checkInDate.getMonth() === day.getMonth() &&
               checkInDate.getFullYear() === day.getFullYear();
      });
      
      return {
        name: format(day, 'EEE'),
        checkIns: checkInsOnDay.length
      };
    });
  };

  const chartData = generateChartData();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-1/5">
            <Sidebar />
          </div>

          {/* Main Content Area */}
          <div className="lg:w-4/5 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <CardTitle className="text-xl font-bold">Check-in Management</CardTitle>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList>
                      <TabsTrigger value="list">List View</TabsTrigger>
                      <TabsTrigger value="scan">QR Scanner</TabsTrigger>
                      <TabsTrigger value="stats">Statistics</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              
              <CardContent>
                <TabsContent value="list" className="mt-0 pt-4">
                  {/* Search and Filter */}
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by member name or ID"
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Time Period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button variant="outline" className="flex items-center">
                        <Download className="mr-2 h-4 w-4" /> Export
                      </Button>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-gray-500">Loading check-ins...</p>
                    </div>
                  ) : filteredCheckIns.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership ID</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredCheckIns.map((checkIn, index) => (
                            <tr key={checkIn.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(checkIn.timestamp), "MMM d, yyyy h:mm a")}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                                    {getMemberName(checkIn.userId)
                                      .split(' ')
                                      .map(name => name[0])
                                      .join('')}
                                  </div>
                                  <div className="ml-3 text-sm font-medium text-gray-900">
                                    {getMemberName(checkIn.userId)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {checkIn.membershipId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {checkIn.location}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900">No check-ins found</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {searchQuery ? "Try adjusting your search criteria" : "No check-ins have been recorded"}
                      </p>
                    </div>
                  )}

                  {/* Pagination */}
                  {checkInsData && checkInsData.total > itemsPerPage && (
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, checkInsData.total)} of {checkInsData.total} check-ins
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(currentPage - 1)}
                        >
                          <span className="sr-only">Previous page</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center">
                          {Array.from(
                            { length: Math.ceil(checkInsData.total / itemsPerPage) }, 
                            (_, i) => i + 1
                          ).slice(0, 5).map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              className="mx-1 h-8 w-8 p-0"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon"
                          disabled={currentPage === Math.ceil(checkInsData.total / itemsPerPage)}
                          onClick={() => setCurrentPage(currentPage + 1)}
                        >
                          <span className="sr-only">Next page</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="scan" className="mt-0 pt-4">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/2">
                      <div className="bg-neutral-light rounded-lg p-6 border border-gray-200 mb-6">
                        <h3 className="text-lg font-bold mb-4">QR Code Scanner</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Scan a member's QR code to check them in.
                        </p>
                        <QRScanner 
                          onScan={handleScan}
                          onError={(error) => {
                            toast({
                              title: "Scanner Error",
                              description: error,
                              variant: "destructive",
                            });
                          }}
                          height={250}
                          width={250}
                        />
                        {checkInMutation.isPending && (
                          <div className="text-center mt-4 p-3 bg-primary/10 rounded-md">
                            <p className="text-primary">Processing check-in...</p>
                          </div>
                        )}
                        
                        {checkInMutation.isSuccess && (
                          <div className="text-center mt-4 p-3 bg-green-100 rounded-md flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            <p className="text-green-600">Successfully checked in!</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <h3 className="text-lg font-bold mb-4">Manual Check-in</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Enter a member's ID to check them in manually.
                        </p>
                        <div className="flex mb-4">
                          <Input 
                            type="text"
                            placeholder="Enter Member ID or search by name"
                            className="rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          <Button className="bg-primary hover:bg-primary/90 rounded-l-none">
                            Check In
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="md:w-1/2">
                      <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold">Today's Check-ins</h3>
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            {todayCheckIns?.length || 0} Total
                          </Badge>
                        </div>
                        
                        {todayCheckIns && todayCheckIns.length > 0 ? (
                          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                            {todayCheckIns.map(checkIn => (
                              <div key={checkIn.id} className="flex items-center justify-between bg-neutral-light p-3 rounded-md">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-medium mr-3">
                                    {getMemberName(checkIn.userId)
                                      .split(' ')
                                      .map(name => name[0])
                                      .join('')}
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-sm">{getMemberName(checkIn.userId)}</h5>
                                    <p className="text-xs text-gray-500">
                                      {format(new Date(checkIn.timestamp), "h:mm a")} at {checkIn.location}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">No check-ins today</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Check-ins will appear here as members arrive
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="mt-0 pt-4">
                  <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Weekly Check-in Statistics</h3>
                        <Select defaultValue="thisWeek">
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Time Period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="thisWeek">This Week</SelectItem>
                            <SelectItem value="lastWeek">Last Week</SelectItem>
                            <SelectItem value="lastMonth">Last Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="checkIns" fill="#3ABDB7" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold">Today</h4>
                            <Badge variant="outline" className="bg-primary/10 text-primary">
                              {todayCheckIns?.length || 0}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            {todayCheckIns && todayCheckIns.length > 0 ? (
                              <p>Peak time: {format(new Date(), "h:mm a")}</p>
                            ) : (
                              <p>No check-ins recorded</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold">This Week</h4>
                            <Badge variant="outline" className="bg-secondary/10 text-secondary">
                              {chartData.reduce((sum, item) => sum + item.checkIns, 0)}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>Busiest day: {chartData.length > 0 ? chartData.reduce((a, b) => a.checkIns > b.checkIns ? a : b).name : "N/A"}</p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold">Average</h4>
                            <Badge variant="outline" className="bg-[#FF7F50]/10 text-[#FF7F50]">
                              {chartData.length > 0 
                                ? Math.round(chartData.reduce((sum, item) => sum + item.checkIns, 0) / chartData.length) 
                                : 0}/day
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>Trend: {Math.random() > 0.5 ? "+5% vs last week" : "-3% vs last week"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
