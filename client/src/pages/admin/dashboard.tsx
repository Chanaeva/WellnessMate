import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, Clock, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AdminDashboard() {
  const [membershipId, setMembershipId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const { toast } = useToast();

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
      
      const result = await response.json();
      
      toast({
        title: "Check-in Successful",
        description: `${result.member.username} has been checked in`,
      });
      
      setMembershipId("");
    } catch (error: any) {
      toast({
        title: "Check-in Failed",
        description: error.message || "Unable to check in member",
        variant: "destructive",
      });
    }
  };

  // Prepare chart data for visit analytics
  const chartData = analytics?.visitsByDate ? 
    Object.entries(analytics.visitsByDate).map(([date, visits]) => ({
      date: new Date(date).toLocaleDateString(),
      visits: visits as number,
    })) : [];

  // Prepare peak hours chart data
  const peakHoursData = peakHours?.hourlyData || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Staff Dashboard</h1>
          <p className="text-slate-600">Wolf Mother Wellness Management</p>
        </div>

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

        {/* Manual Check-in */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter membership ID"
                value={membershipId}
                onChange={(e) => setMembershipId(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleManualCheckIn()}
                className="flex-1"
              />
              <Button onClick={handleManualCheckIn}>
                Check In
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Charts */}
        <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPeriod} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Visit Analytics Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Visit Analytics - {selectedPeriod}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="visits" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Peak Hours Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={peakHoursData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="visits" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}