import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Search, Download, UserPlus, Ticket, Minus, Plus, Trash2, Edit2, CheckSquare, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { format } from "date-fns";
import { formatTimeCST, formatDateCST, formatDateTimeCST, formatISODateCST, formatTime24CST } from "@/lib/timezone";
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

interface WaiverQuestion {
  id: number;
  question: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface GuestWaiverAnswer {
  id: number;
  guestWaiverId: number;
  questionId: number;
  answer: boolean;
  question: WaiverQuestion;
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

  // Guest detail dialog
  const [selectedGuestEntry, setSelectedGuestEntry] = useState<any | null>(null);

  // Waiver questions panel
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question: "", description: "", isRequired: false });
  const [editingQuestion, setEditingQuestion] = useState<WaiverQuestion | null>(null);
  const [editForm, setEditForm] = useState({ question: "", description: "", isRequired: false });

  const { toast } = useToast();

  // Unified check-ins (members + guests merged)
  const unifiedParams = new URLSearchParams({
    page: currentPage.toString(),
    pageSize: pageSize.toString(),
    period: filterPeriod,
    ...(searchTerm ? { search: searchTerm } : {}),
  });
  const { data: unifiedData, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: [`/api/admin/unified-check-ins?${unifiedParams}`],
    staleTime: 1 * 60 * 1000,
  });

  const { data: todayCount } = useQuery<{ members: number; guests: number; total: number }>({
    queryKey: ["/api/admin/unified-check-ins/today-count"],
    staleTime: 1 * 60 * 1000,
  });

  // Waiver questions
  const { data: waiverQuestions = [], isLoading: isLoadingQuestions } = useQuery<WaiverQuestion[]>({
    queryKey: ["/api/admin/waiver-questions"],
    staleTime: 30 * 1000,
  });

  // Guest waiver answers (fetched when a guest row is clicked)
  const { data: guestAnswers = [], isLoading: isLoadingAnswers } = useQuery<GuestWaiverAnswer[]>({
    queryKey: ["/api/admin/guest-waivers", selectedGuestEntry?.id, "answers"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/guest-waivers/${selectedGuestEntry.id}/answers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load answers");
      return res.json();
    },
    enabled: !!selectedGuestEntry && selectedGuestEntry.entry_type === "guest",
    staleTime: 0,
  });

  const { data: memberSearchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/admin/member-search", memberSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/admin/member-search?q=${encodeURIComponent(memberSearchTerm)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return await res.json();
    },
    enabled: memberSearchTerm.length >= 2,
    staleTime: 0,
  });

  const { data: punchSearchResults, isLoading: isPunchSearching } = useQuery({
    queryKey: ["/api/admin/member-search", punchSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/admin/member-search?q=${encodeURIComponent(punchSearchTerm)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return await res.json();
    },
    enabled: punchSearchTerm.length >= 2,
    staleTime: 0,
  });

  // Waiver question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: { question: string; description?: string; isRequired: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/waiver-questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiver-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiver-questions"] });
      setNewQuestion({ question: "", description: "", isRequired: false });
      toast({ title: "Question added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<WaiverQuestion> }) => {
      const res = await apiRequest("PATCH", `/api/admin/waiver-questions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiver-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiver-questions"] });
      setEditingQuestion(null);
      toast({ title: "Question updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/waiver-questions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiver-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiver-questions"] });
      toast({ title: "Question deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unified-check-ins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
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

  const entries = unifiedData?.data || [];
  const totalPages = Math.ceil((unifiedData?.total || 0) / pageSize);

  const exportCheckIns = () => {
    const headers = ["Date", "Time", "Type", "Name", "Email", "Phone", "Membership ID", "Method"];
    const csvData = [
      headers.join(","),
      ...entries.map((entry: any) => [
        formatISODateCST(entry.ts),
        formatTime24CST(entry.ts),
        entry.entry_type === "guest" ? "Guest" : "Member",
        `${entry.first_name} ${entry.last_name}`.trim(),
        entry.email || "N/A",
        entry.phone_number || "N/A",
        entry.membership_id || "N/A",
        entry.method || "N/A",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits-${format(new Date(), "yyyy-MM-dd")}.csv`;
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

  const startEdit = (q: WaiverQuestion) => {
    setEditingQuestion(q);
    setEditForm({ question: q.question, description: q.description ?? "", isRequired: q.isRequired });
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
                {todayCount?.total || 0}
              </div>
              <p className="text-sm text-muted-foreground">visits today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Member Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {todayCount?.members || 0}
              </div>
              <p className="text-sm text-muted-foreground">members today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guest Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {todayCount?.guests || 0}
              </div>
              <p className="text-sm text-muted-foreground">guest waivers today</p>
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

        {/* Waiver Questions Management Panel */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowQuestionsPanel(v => !v)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                <CardTitle>Guest Waiver Questions</CardTitle>
                <Badge variant="secondary">{waiverQuestions.length} questions</Badge>
              </div>
              {showQuestionsPanel ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">
              Configurable checkboxes shown on the guest check-in waiver form
            </p>
          </CardHeader>

          {showQuestionsPanel && (
            <CardContent className="space-y-4">
              {/* Existing questions */}
              {isLoadingQuestions ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading questions...</p>
              ) : waiverQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No questions yet. Add one below.</p>
              ) : (
                <div className="space-y-2">
                  {waiverQuestions.map(q => (
                    <div key={q.id} className="border rounded-lg p-3 bg-white">
                      {editingQuestion?.id === q.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editForm.question}
                            onChange={e => setEditForm(f => ({ ...f, question: e.target.value }))}
                            placeholder="Question text"
                          />
                          <Input
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description (optional)"
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editForm.isRequired}
                              onCheckedChange={v => setEditForm(f => ({ ...f, isRequired: v }))}
                            />
                            <span className="text-sm">Required</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateQuestionMutation.mutate({
                                id: q.id,
                                data: { question: editForm.question, description: editForm.description || null, isRequired: editForm.isRequired },
                              })}
                              disabled={updateQuestionMutation.isPending}
                            >
                              <Check className="h-3 w-3 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingQuestion(null)}>
                              <X className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{q.question}</span>
                              {q.isRequired && <Badge variant="destructive" className="text-xs">Required</Badge>}
                              {!q.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                            </div>
                            {q.description && <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={q.isActive}
                              onCheckedChange={v => updateQuestionMutation.mutate({ id: q.id, data: { isActive: v } })}
                            />
                            <Button size="icon" variant="ghost" onClick={() => startEdit(q)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm("Delete this question? Historical answers will also be removed.")) {
                                  deleteQuestionMutation.mutate(q.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new question form */}
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-3">
                <h4 className="font-semibold text-blue-800 text-sm">Add New Question</h4>
                <Input
                  value={newQuestion.question}
                  onChange={e => setNewQuestion(q => ({ ...q, question: e.target.value }))}
                  placeholder="e.g., Visiting from Gravity Bear Climbing Gym?"
                  className="bg-white"
                />
                <Input
                  value={newQuestion.description}
                  onChange={e => setNewQuestion(q => ({ ...q, description: e.target.value }))}
                  placeholder="Optional description or sub-text"
                  className="bg-white"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newQuestion.isRequired}
                    onCheckedChange={v => setNewQuestion(q => ({ ...q, isRequired: v }))}
                  />
                  <span className="text-sm text-blue-800">Mark as required</span>
                </div>
                <Button
                  onClick={() => {
                    if (!newQuestion.question.trim()) return;
                    createQuestionMutation.mutate({
                      question: newQuestion.question.trim(),
                      description: newQuestion.description.trim() || undefined,
                      isRequired: newQuestion.isRequired,
                    });
                  }}
                  disabled={!newQuestion.question.trim() || createQuestionMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createQuestionMutation.isPending ? "Adding..." : "Add Question"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Visit Log */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Log</CardTitle>
            <p className="text-sm text-muted-foreground">Member check-ins and guest waiver visits combined. Click any guest row to view their waiver answers.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>

              <Select value={filterPeriod} onValueChange={(v) => { setFilterPeriod(v); setCurrentPage(1); }}>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading visits...
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No visits found
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry: any, idx: number) => (
                      <TableRow
                        key={`${entry.entry_type}-${entry.id}-${idx}`}
                        className={entry.entry_type === "guest" ? "cursor-pointer hover:bg-purple-50" : ""}
                        onClick={() => {
                          if (entry.entry_type === "guest") setSelectedGuestEntry(entry);
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {formatDateCST(entry.ts)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatTimeCST(entry.ts)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {entry.first_name} {entry.last_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.email || "N/A"}
                        </TableCell>
                        <TableCell>
                          {entry.entry_type === "guest" ? (
                            <span className="text-sm text-muted-foreground">
                              {entry.phone_number || "No phone"}
                            </span>
                          ) : (
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {entry.membership_id?.startsWith("day-pass-") ? (
                                <span className="text-amber-600">Day Pass</span>
                              ) : (
                                entry.membership_id || "N/A"
                              )}
                            </code>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.entry_type === "guest" ? (
                            <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                              Guest
                            </Badge>
                          ) : entry.method === "manual" ? (
                            <Badge variant="secondary">Manual</Badge>
                          ) : (
                            <Badge variant="default">QR Code</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, unifiedData?.total || 0)} of {unifiedData?.total || 0} visits
                </p>
                <div className="flex gap-2">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guest Detail Dialog */}
      <Dialog open={!!selectedGuestEntry} onOpenChange={open => { if (!open) setSelectedGuestEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">Guest</Badge>
              {selectedGuestEntry?.first_name} {selectedGuestEntry?.last_name}
            </DialogTitle>
            <DialogDescription>
              Checked in {selectedGuestEntry ? formatDateTimeCST(selectedGuestEntry.ts) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground font-medium">Email</p>
                <p>{selectedGuestEntry?.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Phone</p>
                <p>{selectedGuestEntry?.phone_number || "—"}</p>
              </div>
            </div>

            {/* Waiver question answers */}
            <div>
              <p className="font-semibold text-sm mb-2">Waiver Questions</p>
              {isLoadingAnswers ? (
                <p className="text-sm text-muted-foreground">Loading answers...</p>
              ) : guestAnswers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No questions were on the form at this time.</p>
              ) : (
                <div className="space-y-2">
                  {guestAnswers.map(a => (
                    <div key={a.id} className="flex items-start gap-2 text-sm">
                      <div className={`mt-0.5 shrink-0 h-5 w-5 rounded flex items-center justify-center ${a.answer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {a.answer ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div>
                        <span className="font-medium">{a.question.question}</span>
                        {a.question.description && (
                          <p className="text-xs text-muted-foreground">{a.question.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGuestEntry(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Check-in Dialog */}
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
                        {member.membershipStatus === "active" && (
                          <Badge className="bg-green-100 text-green-800">Active Member</Badge>
                        )}
                        {member.dayPassesRemaining > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 ml-1">
                            <Ticket className="h-3 w-3 mr-1" />
                            {member.dayPassesRemaining} passes
                          </Badge>
                        )}
                        {member.membershipStatus !== "active" && member.dayPassesRemaining === 0 && (
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
                  {selectedMember.membershipStatus === "active" && (
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

                  {selectedMember.membershipStatus !== "active" && selectedMember.dayPassesRemaining === 0 && (
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

      {/* Punch Deduction Dialog */}
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
