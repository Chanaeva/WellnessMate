import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, UserCheck, Clock, Search, User, Calendar, CreditCard, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type MemberSearchResult = {
  id: number;
  username: string;
  email: string;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  membership?: {
    membershipId: string;
    status: string;
    planType: string;
    startDate: string;
    endDate: string;
  };
  dayPassCount: number;
};

export default function StaffCheckIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [showDayPassDialog, setShowDayPassDialog] = useState(false);
  const { toast } = useToast();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search members query
  const { data: searchResults, isLoading: isSearching } = useQuery<MemberSearchResult[]>({
    queryKey: ['/api/staff/search-members', debouncedSearchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/staff/search-members?query=${encodeURIComponent(debouncedSearchTerm)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to search members');
      }
      return response.json();
    },
    enabled: debouncedSearchTerm.length >= 2,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async ({ membershipId, userId, useDayPass }: { membershipId?: string; userId?: number; useDayPass?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/manual-checkin", {
        membershipId,
        userId,
        useDayPass,
      });
      return response.json();
    },
    onSuccess: (result) => {
      setLastCheckIn({
        member: result.member,
        timestamp: new Date(),
        membershipId: result.membershipId
      });
      
      toast({
        title: "Check-in Successful",
        description: `${result.member.username} has been checked in`,
      });
      
      // Invalidate search results to refresh day pass counts
      queryClient.invalidateQueries({ queryKey: ['/api/staff/search-members'] });
      
      // Clear selected member and close dialogs
      setSelectedMember(null);
      setShowDayPassDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Check-in Failed",
        description: error.message || "Unable to check in member",
        variant: "destructive",
      });
    }
  });

  const processCheckIn = async (membershipId: string) => {
    setIsLoading(true);
    try {
      await checkInMutation.mutateAsync({ membershipId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCheckIn = (member: MemberSearchResult, useDayPass: boolean = false) => {
    if (useDayPass && member.dayPassCount === 0) {
      toast({
        title: "No Day Passes Available",
        description: "This member has no remaining day passes",
        variant: "destructive",
      });
      return;
    }

    if (useDayPass) {
      setSelectedMember(member);
      setShowDayPassDialog(true);
    } else if (member.membership) {
      checkInMutation.mutate({ 
        membershipId: member.membership.membershipId,
        userId: member.id 
      });
    }
  };

  const confirmDayPassCheckIn = () => {
    if (selectedMember) {
      checkInMutation.mutate({ 
        userId: selectedMember.id,
        useDayPass: true 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Staff Check-in</h1>
          <p className="text-slate-600">Wolf Mother Wellness Front Desk</p>
        </div>

        {/* Member Check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Staff-Assisted Member Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Search for a member by name, email, or phone number:
              </p>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-member-search"
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Searching members...</p>
                </div>
              )}

              {debouncedSearchTerm.length >= 2 && !isSearching && searchResults && searchResults.length === 0 && (
                <div className="text-center py-8" data-testid="empty-search-results">
                  <User className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600">No members found matching "{debouncedSearchTerm}"</p>
                </div>
              )}

              {debouncedSearchTerm.length < 2 && !isSearching && (
                <div className="text-center py-8 text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">Enter at least 2 characters to search</p>
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div className="space-y-3" data-testid="search-results-container">
                  {searchResults.map((member) => (
                    <Card key={member.id} className="hover:shadow-md transition-shadow" data-testid={`member-card-${member.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* Member Info */}
                            <div>
                              <h3 className="font-semibold text-lg" data-testid={`member-name-${member.id}`}>
                                {member.firstName} {member.lastName}
                              </h3>
                              <p className="text-sm text-gray-600" data-testid={`member-email-${member.id}`}>
                                {member.email}
                              </p>
                              {member.phoneNumber && (
                                <p className="text-sm text-gray-600" data-testid={`member-phone-${member.id}`}>
                                  {member.phoneNumber}
                                </p>
                              )}
                            </div>

                            {/* Membership Status */}
                            {member.membership && member.membership.status === 'active' && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`membership-badge-${member.id}`}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active: {member.membership.planType}
                                </Badge>
                                <span className="text-xs text-gray-500" data-testid={`membership-dates-${member.id}`}>
                                  Until {new Date(member.membership.endDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            
                            {member.membership && member.membership.status !== 'active' && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600" data-testid={`membership-expired-${member.id}`}>
                                Membership: {member.membership.status}
                              </Badge>
                            )}

                            {/* Day Pass Info */}
                            {member.dayPassCount > 0 && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-blue-300 text-blue-700" data-testid={`day-pass-badge-${member.id}`}>
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  {member.dayPassCount} Day Pass{member.dayPassCount !== 1 ? 'es' : ''}
                                </Badge>
                              </div>
                            )}

                            {!member.membership && member.dayPassCount === 0 && (
                              <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-300" data-testid={`no-access-badge-${member.id}`}>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                No Active Access
                              </Badge>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2">
                            {member.membership && member.membership.status === 'active' && (
                              <Button
                                size="sm"
                                onClick={() => handleManualCheckIn(member, false)}
                                disabled={checkInMutation.isPending}
                                data-testid={`button-checkin-${member.id}`}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Check In
                              </Button>
                            )}
                            
                            {member.dayPassCount > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleManualCheckIn(member, true)}
                                disabled={checkInMutation.isPending}
                                data-testid={`button-use-day-pass-${member.id}`}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Use Day Pass
                              </Button>
                            )}

                            {member.membership && member.membership.status !== 'active' && member.dayPassCount === 0 && (
                              <Button size="sm" variant="secondary" disabled data-testid={`button-no-access-${member.id}`}>
                                No Access
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Last Check-in Display */}
            {lastCheckIn && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Check-in Successful</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Member:</strong> {lastCheckIn.member.username}</p>
                  <p><strong>Email:</strong> {lastCheckIn.member.email}</p>
                  <p><strong>Membership ID:</strong> {lastCheckIn.membershipId}</p>
                  <p><strong>Time:</strong> {lastCheckIn.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Check-in Process:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Search for the member by name, email, or phone</li>
                <li>• Select the member from the search results</li>
                <li>• Click "Check In" or "Use Day Pass" as appropriate</li>
                <li>• A confirmation will appear when successful</li>
              </ul>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-gray-600" />
                <div className="text-sm font-medium text-gray-700">Current Time</div>
                <div className="text-lg font-bold text-gray-900">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <UserCheck className="h-4 w-4 mx-auto mb-1 text-gray-600" />
                <div className="text-sm font-medium text-gray-700">Check-in Method</div>
                <Badge variant="secondary" className="text-xs">Manual</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Return to Main Dashboard
          </a>
        </div>
      </div>

      {/* Day Pass Confirmation Dialog */}
      <Dialog open={showDayPassDialog} onOpenChange={setShowDayPassDialog}>
        <DialogContent data-testid="dialog-day-pass-confirm">
          <DialogHeader>
            <DialogTitle>Confirm Day Pass Usage</DialogTitle>
            <DialogDescription>
              This will use one day pass for the member's check-in.
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-3 py-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Member</p>
                <p className="font-semibold">{selectedMember.firstName} {selectedMember.lastName}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">Day Passes Available</p>
                <p className="text-2xl font-bold text-blue-900">{selectedMember.dayPassCount}</p>
                <p className="text-xs text-blue-600 mt-1">
                  After check-in: {selectedMember.dayPassCount - 1} remaining
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDayPassDialog(false)}
              disabled={checkInMutation.isPending}
              data-testid="button-cancel-day-pass"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDayPassCheckIn}
              disabled={checkInMutation.isPending}
              data-testid="button-confirm-day-pass"
            >
              {checkInMutation.isPending ? "Processing..." : "Confirm Check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}