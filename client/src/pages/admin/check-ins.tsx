import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Search, Download, UserPlus, Ticket, Minus } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface MemberSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  membershipId: string | null;
  membershipStatus: string;
  dayPassesRemaining: number;
}

export default function AdminCheckIns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterPeriod, setFilterPeriod] = useState("today");
  const [isManualCheckInOpen, setIsManualCheckInOpen] = useState(false);
  const [isPunchDeductionOpen, setIsPunchDeductionOpen] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [punchSearchTerm, setPunchSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [selectedPunchMember, setSelectedPunchMember] = useState<MemberSearchResult | null>(null);
  const [deductionReason, setDeductionReason] = useState("");
  const { toast } = useToast();

  const { data: checkInsData, isLoading } = useQuery({
    queryKey: ["/api/admin/check-ins", currentPage, pageSize],
    staleTime: 2 * 60 * 1000,
  });

  const { data: todayCheckIns } = useQuery({
    queryKey: ["/api/check-ins/today"],
    staleTime: 1 * 60 * 1000,
  });

  const { data: memberSearchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/admin/member-search", memberSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/admin/member-search?q=${encodeURIComponent(memberSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Search failed');
      return await res.json();
    },
    enabled: memberSearchTerm.length >= 2,
    staleTime: 0,
  });

  const { data: punchSearchResults, isLoading: isPunchSearching } = useQuery({
    queryKey: ["/api/admin/member-search", punchSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/admin/member-search?q=${encodeURIComponent(punchSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Search failed');
      return await res.json();
    },
    enabled: punchSearchTerm.length >= 2,
    staleTime: 0,
  });

  const manualCheckInMutation = useMutation({
    mutationFn: async ({ userId, useDayPass }: { userId: number; useDayPass: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/manual-checkin", { userId, useDayPass });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-in Successful",
        description: data.dayPassUsed 
          ? `${selectedMember?.firstName} checked in using day pass. ${data.remainingPasses} passes remaining.`
          : `${selectedMember?.firstName} checked in successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check-ins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/today"] });
      setIsManualCheckInOpen(false);
      setSelectedMember(null);
      setMemberSearchTerm("");
    },
    onError: (error: any) => {
      toast({
        title: "Check-in Failed",
        description: error.message || "Failed to check in member",
        variant: "destructive",
      });
    },
  });

  const punchDeductionMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const res = await apiRequest("POST", "/api/admin/manual-punch-deduction", { userId, reason });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Punch Deducted",
        description: `Successfully deducted 1 punch from ${selectedPunchMember?.firstName}'s day pass. ${data.remainingPunches} punches remaining.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/member-search"] });
      setIsPunchDeductionOpen(false);
      setSelectedPunchMember(null);
      setPunchSearchTerm("");
      setDeductionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Punch Deduction Failed",
        description: error.message || "Failed to deduct punch",
        variant: "destructive",
      });
    },
  });

  const checkIns = checkInsData?.data || [];
  const totalPages = Math.ceil((checkInsData?.total || 0) / pageSize);

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

  const handleCheckIn = (useDayPass: boolean) => {
    if (selectedMember) {
      manualCheckInMutation.mutate({ userId: selectedMember.id, useDayPass });
    }
  };

  const handlePunchDeduction = () => {
    if (selectedPunchMember) {
      punchDeductionMutation.mutate({ userId: selectedPunchMember.id, reason: deductionReason });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Visit Logging</h1>
          <p className="text-slate-600">Wolf Mother Wellness Check-in Management</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
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

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-800">Manual Check-in</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsManualCheckInOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Check In Member
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg text-amber-800">Punch Day Pass</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsPunchDeductionOpen(true)}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                <Minus className="h-4 w-4 mr-2" />
                Deduct Punch
              </Button>
            </CardContent>
          </Card>
        </div>

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
                            {checkIn.user?.firstName} {checkIn.user?.lastName || checkIn.user?.username || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {checkIn.user?.email || "N/A"}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {checkIn.membershipId?.startsWith('day-pass-') ? (
                              <span className="text-amber-600">Day Pass</span>
                            ) : (
                              checkIn.membershipId || "N/A"
                            )}
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

      <Dialog open={isManualCheckInOpen} onOpenChange={setIsManualCheckInOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual Member Check-in</DialogTitle>
            <DialogDescription>
              Search for a member to check them in manually
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={memberSearchTerm}
                onChange={(e) => {
                  setMemberSearchTerm(e.target.value);
                  setSelectedMember(null);
                }}
                className="pl-10"
              />
            </div>

            {isSearching && (
              <div className="text-center py-4 text-muted-foreground">
                Searching...
              </div>
            )}

            {memberSearchResults && memberSearchResults.length > 0 && !selectedMember && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {memberSearchResults.map((member: MemberSearchResult) => (
                  <div
                    key={member.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{member.firstName} {member.lastName}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                      <div className="text-right">
                        {member.membershipStatus === 'active' && (
                          <Badge className="bg-green-100 text-green-800">Active Member</Badge>
                        )}
                        {member.dayPassesRemaining > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 ml-1">
                            <Ticket className="h-3 w-3 mr-1" />
                            {member.dayPassesRemaining} passes
                          </Badge>
                        )}
                        {member.membershipStatus !== 'active' && member.dayPassesRemaining === 0 && (
                          <Badge variant="secondary">No access</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {memberSearchTerm.length >= 2 && memberSearchResults?.length === 0 && !isSearching && (
              <div className="text-center py-4 text-muted-foreground">
                No members found
              </div>
            )}

            {selectedMember && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold text-lg">{selectedMember.firstName} {selectedMember.lastName}</div>
                    <div className="text-sm text-muted-foreground">{selectedMember.email}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                    Change
                  </Button>
                </div>

                <div className="space-y-2">
                  {selectedMember.membershipStatus === 'active' && (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleCheckIn(false)}
                      disabled={manualCheckInMutation.isPending}
                    >
                      {manualCheckInMutation.isPending ? "Checking in..." : "Check In (Membership)"}
                    </Button>
                  )}

                  {selectedMember.dayPassesRemaining > 0 && (
                    <Button 
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => handleCheckIn(true)}
                      disabled={manualCheckInMutation.isPending}
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      {manualCheckInMutation.isPending 
                        ? "Checking in..." 
                        : `Check In (Use Day Pass - ${selectedMember.dayPassesRemaining} remaining)`}
                    </Button>
                  )}

                  {selectedMember.membershipStatus !== 'active' && selectedMember.dayPassesRemaining === 0 && (
                    <div className="text-center py-2 text-red-600">
                      This member has no active membership or day passes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsManualCheckInOpen(false);
              setSelectedMember(null);
              setMemberSearchTerm("");
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPunchDeductionOpen} onOpenChange={setIsPunchDeductionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual Punch Deduction</DialogTitle>
            <DialogDescription>
              Deduct a punch from a member's day pass without creating a check-in record
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={punchSearchTerm}
                onChange={(e) => {
                  setPunchSearchTerm(e.target.value);
                  setSelectedPunchMember(null);
                }}
                className="pl-10"
              />
            </div>

            {isPunchSearching && (
              <div className="text-center py-4 text-muted-foreground">
                Searching...
              </div>
            )}

            {punchSearchResults && punchSearchResults.length > 0 && !selectedPunchMember && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {punchSearchResults
                  .filter((member: MemberSearchResult) => member.dayPassesRemaining > 0)
                  .map((member: MemberSearchResult) => (
                  <div
                    key={member.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => setSelectedPunchMember(member)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{member.firstName} {member.lastName}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800">
                        <Ticket className="h-3 w-3 mr-1" />
                        {member.dayPassesRemaining} passes
                      </Badge>
                    </div>
                  </div>
                ))}
                {punchSearchResults.filter((m: MemberSearchResult) => m.dayPassesRemaining > 0).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No members with day passes found
                  </div>
                )}
              </div>
            )}

            {punchSearchTerm.length >= 2 && punchSearchResults?.length === 0 && !isPunchSearching && (
              <div className="text-center py-4 text-muted-foreground">
                No members found
              </div>
            )}

            {selectedPunchMember && (
              <div className="border rounded-lg p-4 bg-amber-50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold text-lg">{selectedPunchMember.firstName} {selectedPunchMember.lastName}</div>
                    <div className="text-sm text-muted-foreground">{selectedPunchMember.email}</div>
                    <Badge className="bg-amber-100 text-amber-800 mt-2">
                      <Ticket className="h-3 w-3 mr-1" />
                      {selectedPunchMember.dayPassesRemaining} passes remaining
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPunchMember(null)}>
                    Change
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reason">Reason (optional)</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Check-in failed, system issue..."
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={handlePunchDeduction}
                    disabled={punchDeductionMutation.isPending}
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    {punchDeductionMutation.isPending 
                      ? "Deducting..." 
                      : "Deduct 1 Punch"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsPunchDeductionOpen(false);
              setSelectedPunchMember(null);
              setPunchSearchTerm("");
              setDeductionReason("");
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
