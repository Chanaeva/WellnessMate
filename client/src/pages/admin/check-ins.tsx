import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download } from "lucide-react";
import { format } from "date-fns";

export default function AdminCheckIns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterPeriod, setFilterPeriod] = useState("today");

  // Fetch all check-ins with pagination
  const { data: checkInsData, isLoading } = useQuery({
    queryKey: ["/api/admin/check-ins", currentPage, pageSize],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch today's check-ins for quick overview
  const { data: todayCheckIns } = useQuery({
    queryKey: ["/api/check-ins/today"],
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const checkIns = checkInsData?.data || [];
  const totalPages = Math.ceil((checkInsData?.total || 0) / pageSize);

  // Filter check-ins based on search term
  const filteredCheckIns = checkIns.filter((checkIn: any) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      checkIn.user?.username?.toLowerCase().includes(searchLower) ||
      checkIn.user?.email?.toLowerCase().includes(searchLower) ||
      checkIn.membershipId?.toLowerCase().includes(searchLower)
    );
  });

  const exportCheckIns = () => {
    // Create CSV data
    const headers = ["Date", "Time", "Member", "Email", "Membership ID", "Method"];
    const csvData = [
      headers.join(","),
      ...filteredCheckIns.map((checkIn: any) => [
        format(new Date(checkIn.timestamp), "yyyy-MM-dd"),
        format(new Date(checkIn.timestamp), "HH:mm:ss"),
        checkIn.user?.username || "N/A",
        checkIn.user?.email || "N/A",
        checkIn.membershipId || "N/A",
        checkIn.method || "qr"
      ].join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkins-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Visit Logging</h1>
          <p className="text-slate-600">Wolf Mother Wellness Check-in Management</p>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {todayCheckIns?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">check-ins today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">QR Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {todayCheckIns?.filter((c: any) => c.method === "qr").length || 0}
              </div>
              <p className="text-sm text-muted-foreground">self-service</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manual Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {todayCheckIns?.filter((c: any) => c.method === "manual").length || 0}
              </div>
              <p className="text-sm text-muted-foreground">staff assisted</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Check-in History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by member name, email, or membership ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={exportCheckIns} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Check-ins Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Membership ID</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading check-ins...
                      </TableCell>
                    </TableRow>
                  ) : filteredCheckIns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No check-ins found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCheckIns.map((checkIn: any) => (
                      <TableRow key={checkIn.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {format(new Date(checkIn.timestamp), "MMM dd, yyyy")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(checkIn.timestamp), "h:mm a")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {checkIn.user?.username || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {checkIn.user?.email || "N/A"}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {checkIn.membershipId || "N/A"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={checkIn.method === "qr" ? "default" : "secondary"}>
                            {checkIn.method === "qr" ? "QR Code" : "Manual"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}