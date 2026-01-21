import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";
import { 
  CheckCircle, 
  Sparkles, 
  User, 
  Clock,
  ArrowLeft,
  Waves,
  UserPlus,
  Search,
  Crown
} from "lucide-react";
import KioskMemberCreation, { ExistingMember } from "./kiosk-member-creation";

interface CheckInResponse {
  success?: boolean;
  requiresConfirmation?: boolean;
  member?: {
    id?: number;
    firstName: string;
    lastName: string;
    membershipType?: string;
    membershipStatus?: string;
  };
  dayPasses?: {
    available: boolean;
    totalRemaining: number;
    packages: Array<{
      id: number;
      name: string;
      remaining: number;
      total: number;
    }>;
  };
  dayPassInfo?: {
    used: boolean;
    totalRemaining: number;
    packages: Array<{
      id: number;
      name: string;
      remaining: number;
      total: number;
    }>;
  };
  message: string;
}

// Stripe setup - fetch the public key from the server to support test/live key switching
const stripePromise = fetch('/api/stripe/config')
  .then(res => res.json())
  .then(({ publicKey }) => loadStripe(publicKey));

// Form schemas
const memberFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  packageType: z.enum(["membership", "daypass"]),
  packageId: z.string().min(1, "Please select a package"),
});

type MemberFormData = z.infer<typeof memberFormSchema>;

export default function KioskCheckIn() {
  const [scannerMode, setScannerMode] = useState<'waiting' | 'manual-entry' | 'confirmation' | 'success' | 'error' | 'create-member' | 'buy-daypass' | 'buy-membership'>('waiting');
  const [membershipSearchTerm, setMembershipSearchTerm] = useState("");
  const [selectedMemberForMembership, setSelectedMemberForMembership] = useState<ExistingMember | null>(null);
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [manualSearchTerm, setManualSearchTerm] = useState("");
  const [dayPassSearchTerm, setDayPassSearchTerm] = useState("");
  const [selectedExistingMember, setSelectedExistingMember] = useState<ExistingMember | null>(null);
  const { toast } = useToast();
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual search query for email/membership ID lookup
  const { data: manualSearchResults, isError: manualSearchError, isLoading: manualSearchLoading } = useQuery({
    queryKey: ['/api/kiosk/search-member', manualSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/search-member?query=${encodeURIComponent(manualSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Member not found');
      return await res.json();
    },
    enabled: scannerMode === 'manual-entry' && manualSearchTerm.trim().length >= 3,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Day pass search query for existing member lookup
  const { data: dayPassSearchResults, isLoading: dayPassSearchLoading } = useQuery({
    queryKey: ['/api/kiosk/search-member', dayPassSearchTerm, 'daypass'],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/search-member?query=${encodeURIComponent(dayPassSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Member not found');
      return await res.json();
    },
    enabled: scannerMode === 'buy-daypass' && dayPassSearchTerm.trim().length >= 3 && !selectedExistingMember,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Membership search query for existing member lookup
  const { data: membershipSearchResults, isLoading: membershipSearchLoading } = useQuery({
    queryKey: ['/api/kiosk/search-member', membershipSearchTerm, 'membership'],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/search-member?query=${encodeURIComponent(membershipSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Member not found');
      return await res.json();
    },
    enabled: scannerMode === 'buy-membership' && membershipSearchTerm.trim().length >= 3 && !selectedMemberForMembership,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ membershipId, userId, useDayPass }: { membershipId?: string; userId?: number; useDayPass?: boolean }) => {
      const res = await apiRequest("POST", "/api/kiosk-check-in", { membershipId, userId, useDayPass });
      return await res.json() as CheckInResponse;
    },
    onSuccess: (data) => {
      setScanResult(data);
      
      if (data.requiresConfirmation) {
        setScannerMode('confirmation');
        // Don't auto-reset on confirmation
      } else if (data.success) {
        setScannerMode('success');
        queryClient.invalidateQueries({ queryKey: ["/api/check-ins"] });
        
        // Auto-resume scanning after 30 seconds to allow time for item checkout
        autoResumeTimerRef.current = setTimeout(() => {
          resetAndResume();
        }, 30000);
      } else {
        setScannerMode('error');
        
        // Auto-resume scanning after 4 seconds on error
        autoResumeTimerRef.current = setTimeout(() => {
          resetAndResume();
        }, 4000);
      }
    },
    onError: (error: any) => {
      setScanResult({
        success: false,
        message: error.message || "Failed to process check-in"
      });
      setScannerMode('error');
      
      // Auto-resume scanning after 4 seconds on error
      autoResumeTimerRef.current = setTimeout(() => {
        resetAndResume();
      }, 4000);
    },
  });

  const confirmCheckIn = (useDayPass: boolean) => {
    if (pendingUserId) {
      // Day pass user - use userId
      checkInMutation.mutate({ userId: pendingUserId, useDayPass });
    } else if (pendingMembershipId) {
      // Membership user - use membershipId
      checkInMutation.mutate({ membershipId: pendingMembershipId, useDayPass });
    }
  };

  const resetToWaiting = () => {
    // Clear any auto-resume timers
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
      autoResumeTimerRef.current = null;
    }
    
    setScannerMode('waiting');
    setScanResult(null);
    setPendingMembershipId(null);
    setPendingUserId(null);
    setManualSearchTerm("");
    setDayPassSearchTerm("");
    setSelectedExistingMember(null);
  };

  const resetAndResume = () => {
    // Clear any auto-resume timers
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
      autoResumeTimerRef.current = null;
    }
    
    // Reset all state and go back to waiting
    setScanResult(null);
    setPendingMembershipId(null);
    setPendingUserId(null);
    setManualSearchTerm("");
    setDayPassSearchTerm("");
    setMembershipSearchTerm("");
    setSelectedExistingMember(null);
    setSelectedMemberForMembership(null);
    setScannerMode('waiting');
  };

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
      }
    };
  }, []);

  // Show member creation form
  if (scannerMode === 'create-member') {
    return (
      <KioskMemberCreation
        onBack={() => setScannerMode('waiting')}
        onSuccess={() => setScannerMode('waiting')}
      />
    );
  }

  // Show day pass purchase form for selected existing member
  if (selectedExistingMember) {
    return (
      <KioskMemberCreation
        onBack={() => {
          setSelectedExistingMember(null);
          setDayPassSearchTerm("");
          setScannerMode('buy-daypass');
        }}
        onSuccess={() => {
          setSelectedExistingMember(null);
          setDayPassSearchTerm("");
          setScannerMode('waiting');
        }}
        existingMember={selectedExistingMember}
        dayPassOnly={true}
      />
    );
  }

  // Show membership purchase form for selected existing member
  if (selectedMemberForMembership) {
    return (
      <KioskMemberCreation
        onBack={() => {
          setSelectedMemberForMembership(null);
          setMembershipSearchTerm("");
          setScannerMode('buy-membership');
        }}
        onSuccess={() => {
          setSelectedMemberForMembership(null);
          setMembershipSearchTerm("");
          setScannerMode('waiting');
        }}
        existingMember={selectedMemberForMembership}
        dayPassOnly={false}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src={logoMossGreen} 
              alt="Wolf Mother Wellness" 
              className="h-20 w-20 drop-shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
            Wolf Mother Wellness
          </h1>
          <p className="text-xl text-muted-foreground">
            Member Check-In Kiosk
          </p>
        </div>

        {/* Main Content */}
        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              {scannerMode === 'waiting' && <Search className="h-16 w-16 text-primary" />}
              {scannerMode === 'manual-entry' && <User className="h-16 w-16 text-primary" />}
              {scannerMode === 'confirmation' && <User className="h-16 w-16 text-blue-500" />}
              {scannerMode === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
              {scannerMode === 'error' && <User className="h-16 w-16 text-red-500" />}
              {scannerMode === 'buy-daypass' && <Sparkles className="h-16 w-16 text-green-600" />}
              {scannerMode === 'buy-membership' && <Crown className="h-16 w-16 text-primary" />}
            </div>
            <CardTitle className="text-3xl font-heading font-bold">
              {scannerMode === 'waiting' && 'Ready to Check In'}
              {scannerMode === 'manual-entry' && 'Member Search'}
              {scannerMode === 'confirmation' && 'Choose Check-In Method'}
              {scannerMode === 'success' && 'Welcome Back!'}
              {scannerMode === 'error' && 'Check-In Issue'}
              {scannerMode === 'buy-daypass' && 'Purchase Day Pass'}
              {scannerMode === 'buy-membership' && 'Purchase Membership'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Waiting State */}
            {scannerMode === 'waiting' && (
              <div className="text-center space-y-6">
                <p className="text-xl text-muted-foreground mb-8">
                  Welcome! Choose an option below to check in
                </p>
                
                <Button 
                  size="lg" 
                  onClick={() => setScannerMode('manual-entry')}
                  className="bg-primary hover:bg-primary/90 text-white px-12 py-6 text-2xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 w-full"
                  data-testid="button-member-checkin"
                >
                  <User className="h-8 w-8 mr-4" />
                  Member Check-In
                </Button>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Button 
                    onClick={() => setScannerMode('create-member')}
                    variant="outline"
                    size="lg"
                    className="border-2 border-primary text-primary hover:bg-primary/10 text-base font-semibold py-4"
                    data-testid="button-create-member"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    New Member
                  </Button>
                  
                  <Button 
                    onClick={() => setScannerMode('buy-daypass')}
                    variant="outline"
                    size="lg"
                    className="border-2 border-green-600 text-green-600 hover:bg-green-50 text-base font-semibold py-4"
                    data-testid="button-buy-drop-in"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Buy Day Pass
                  </Button>
                  
                  <Button 
                    onClick={() => setScannerMode('buy-membership')}
                    variant="outline"
                    size="lg"
                    className="border-2 border-primary text-primary hover:bg-primary/10 text-base font-semibold py-4"
                    data-testid="button-buy-membership"
                  >
                    <Crown className="h-5 w-5 mr-2" />
                    Buy Membership
                  </Button>
                </div>
                
                <div className="flex items-center justify-center text-sm text-muted-foreground mt-8">
                  <Waves className="h-4 w-4 mr-2" />
                  <span>Sacred waters await your arrival</span>
                </div>
              </div>
            )}

            {/* Manual Entry State */}
            {scannerMode === 'manual-entry' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-lg text-muted-foreground">
                    Search by name, email, or membership ID
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Start typing to search..."
                    value={manualSearchTerm}
                    onChange={(e) => setManualSearchTerm(e.target.value)}
                    className="text-lg py-6"
                    data-testid="input-manual-search"
                    autoFocus
                  />
                  
                  {manualSearchLoading && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Searching...</p>
                    </div>
                  )}
                  
                  {/* Search Results Dropdown */}
                  {manualSearchResults?.members && manualSearchResults.members.length > 0 && (
                    <div className="border rounded-xl overflow-hidden bg-white shadow-lg max-h-80 overflow-y-auto">
                      {manualSearchResults.members.map((member: {
                        id: number;
                        firstName: string;
                        lastName: string;
                        email: string;
                        membershipId: string | null;
                        membershipStatus: string;
                        dayPassesRemaining: number;
                      }) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            if (member.membershipId) {
                              setPendingMembershipId(member.membershipId);
                              setPendingUserId(null);
                              checkInMutation.mutate({ membershipId: member.membershipId });
                            } else {
                              // Check in by userId (works for day pass users or members without active membership)
                              setPendingMembershipId(null);
                              setPendingUserId(member.id);
                              checkInMutation.mutate({ userId: member.id });
                            }
                          }}
                          disabled={checkInMutation.isPending}
                          className="w-full text-left p-4 hover:bg-primary/5 border-b last:border-b-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`member-result-${member.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {member.membershipStatus === 'active' && (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                  Member
                                </Badge>
                              )}
                              {member.membershipStatus === 'day-pass' && (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                  Day Pass ({member.dayPassesRemaining} left)
                                </Badge>
                              )}
                              {member.membershipStatus === 'expired' && (
                                <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                  Expired
                                </Badge>
                              )}
                              {member.membershipStatus === 'none' && member.dayPassesRemaining === 0 && (
                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                                  No Membership
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* No results message */}
                  {manualSearchResults?.members && manualSearchResults.members.length === 0 && manualSearchTerm.length >= 3 && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-yellow-700 font-medium">No members found</p>
                        <p className="text-sm text-yellow-600 mt-1">
                          Try a different search term or check the spelling.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {manualSearchError && manualSearchTerm.length >= 3 && (
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-red-700 font-medium">Search failed</p>
                        <p className="text-sm text-red-600 mt-1">
                          Please try again.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={resetToWaiting}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </div>
            )}

            {/* Buy Day Pass State */}
            {scannerMode === 'buy-daypass' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-lg text-muted-foreground">
                    Search for an existing member or create a new account
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={dayPassSearchTerm}
                    onChange={(e) => setDayPassSearchTerm(e.target.value)}
                    className="text-lg py-6"
                    data-testid="input-daypass-search"
                    autoFocus
                  />
                  
                  {dayPassSearchLoading && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Searching...</p>
                    </div>
                  )}
                  
                  {/* Search Results */}
                  {dayPassSearchResults?.members && dayPassSearchResults.members.length > 0 && (
                    <div className="border rounded-xl overflow-hidden bg-white shadow-lg max-h-60 overflow-y-auto">
                      {dayPassSearchResults.members.map((member: {
                        id: number;
                        firstName: string;
                        lastName: string;
                        email: string;
                        phoneNumber?: string;
                        membershipStatus: string;
                        dayPassesRemaining: number;
                      }) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            setSelectedExistingMember({
                              id: member.id,
                              firstName: member.firstName,
                              lastName: member.lastName,
                              email: member.email,
                              phoneNumber: member.phoneNumber,
                            });
                          }}
                          className="w-full text-left p-4 hover:bg-green-50 border-b last:border-b-0 transition-colors"
                          data-testid={`daypass-member-${member.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                            </div>
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Select
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* No Results */}
                  {dayPassSearchResults?.members && dayPassSearchResults.members.length === 0 && dayPassSearchTerm.length >= 3 && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-yellow-700 font-medium">No members found</p>
                        <p className="text-sm text-yellow-600 mt-1">
                          You can create a new member below.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                <div className="flex gap-4 justify-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={resetToWaiting}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  
                  <Button 
                    onClick={() => setScannerMode('create-member')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Member
                  </Button>
                </div>
              </div>
            )}

            {/* Buy Membership State */}
            {scannerMode === 'buy-membership' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-lg text-muted-foreground">
                    Search for an existing member to purchase a membership
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={membershipSearchTerm}
                    onChange={(e) => setMembershipSearchTerm(e.target.value)}
                    className="text-lg py-6"
                    data-testid="input-membership-search"
                    autoFocus
                  />
                  
                  {membershipSearchLoading && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Searching...</p>
                    </div>
                  )}
                  
                  {/* Search Results */}
                  {membershipSearchResults?.members && membershipSearchResults.members.length > 0 && (
                    <div className="border rounded-xl overflow-hidden bg-white shadow-lg max-h-60 overflow-y-auto">
                      {membershipSearchResults.members.map((member: {
                        id: number;
                        firstName: string;
                        lastName: string;
                        email: string;
                        phoneNumber?: string;
                        membershipStatus: string;
                        dayPassesRemaining: number;
                      }) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            setSelectedMemberForMembership({
                              id: member.id,
                              firstName: member.firstName,
                              lastName: member.lastName,
                              email: member.email,
                              phoneNumber: member.phoneNumber,
                            });
                          }}
                          className="w-full text-left p-4 hover:bg-primary/10 border-b last:border-b-0 transition-colors"
                          data-testid={`membership-member-${member.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                              {member.membershipStatus && (
                                <Badge variant={member.membershipStatus === 'active' ? 'default' : 'secondary'} className="mt-1">
                                  {member.membershipStatus}
                                </Badge>
                              )}
                            </div>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                              Select
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* No Results */}
                  {membershipSearchResults?.members && membershipSearchResults.members.length === 0 && membershipSearchTerm.length >= 3 && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-yellow-700 font-medium">No members found</p>
                        <p className="text-sm text-yellow-600 mt-1">
                          You can create a new member using the New Member option.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                <div className="flex gap-4 justify-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={resetToWaiting}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  
                  <Button 
                    onClick={() => setScannerMode('create-member')}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Member
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmation State */}
            {scannerMode === 'confirmation' && scanResult && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                    <h3 className="text-xl font-bold text-blue-800 mb-2">
                      Hi {scanResult.member?.firstName}!
                    </h3>
                    <p className="text-blue-700 mb-4">
                      {scanResult.message}
                    </p>
                    
                    {scanResult.dayPasses && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="font-semibold text-blue-800 mb-2">Day Passes Available:</p>
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          {scanResult.dayPasses.totalRemaining} days remaining
                        </div>
                        <div className="space-y-1 text-sm text-blue-600">
                          {scanResult.dayPasses.packages.map(pkg => (
                            <div key={pkg.id} className="flex justify-between">
                              <span>{pkg.name}</span>
                              <span>{pkg.remaining}/{pkg.total} remaining</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {(scanResult.member?.membershipStatus === 'active') && (
                      <Button 
                        size="lg"
                        onClick={() => confirmCheckIn(false)}
                        className="bg-primary hover:bg-primary/90 text-white py-6 text-xl font-bold"
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full mr-3" />
                        ) : (
                          <User className="h-6 w-6 mr-3" />
                        )}
                        Use Monthly Membership
                      </Button>
                    )}
                    
                    {scanResult.dayPasses && scanResult.dayPasses.totalRemaining > 0 && (
                      <Button 
                        size="lg"
                        variant="outline"
                        onClick={() => confirmCheckIn(true)}
                        className="border-2 border-primary text-primary hover:bg-primary/10 py-6 text-xl font-bold"
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full mr-3" />
                        ) : (
                          <Sparkles className="h-6 w-6 mr-3" />
                        )}
                        Use Day Pass ({scanResult.dayPasses.totalRemaining} left)
                      </Button>
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    onClick={resetToWaiting}
                    className="mt-4 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Success State */}
            {scannerMode === 'success' && scanResult?.success && (
              <div className="text-center space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <h3 className="text-2xl font-bold text-green-800 mb-2">
                    Welcome back, {scanResult.member?.firstName}!
                  </h3>
                  <div className="flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-green-600 mr-2" />
                    <span className="text-lg text-green-700">Enjoy your session</span>
                    <Sparkles className="h-6 w-6 text-green-600 ml-2" />
                  </div>
                  
                  {scanResult.member?.membershipType && (
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-base px-4 py-1 mb-4">
                      {scanResult.member.membershipType} Check-in
                    </Badge>
                  )}

                  {/* Show day pass info if used */}
                  {scanResult.dayPassInfo?.used && (
                    <div className="bg-white rounded-lg p-4 border border-green-200 mt-4">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="font-semibold text-green-800">Day Pass Used</span>
                      </div>
                      <div className="text-lg font-bold text-green-700 mb-2">
                        {scanResult.dayPassInfo.totalRemaining} days remaining
                      </div>
                      <div className="space-y-1 text-sm text-green-600">
                        {scanResult.dayPassInfo.packages.map(pkg => (
                          <div key={pkg.id} className="flex justify-between">
                            <span>{pkg.name}</span>
                            <span>{pkg.remaining}/{pkg.total} left</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
                
                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>Checked in at {new Date().toLocaleTimeString()}</span>
                </div>
                
                <p className="text-muted-foreground">
                  You may now proceed to the changing area
                </p>
              </div>
            )}

            {/* Error State */}
            {scannerMode === 'error' && (
              <div className="text-center space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-red-800 mb-2">
                    Unable to Check In
                  </h3>
                  <p className="text-red-700">
                    {scanResult?.message || "Please try scanning your QR code again or see staff for assistance."}
                  </p>
                </div>
                
                <Button 
                  onClick={resetToWaiting}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Need help? Please see our staff at the front desk</p>
        </div>
      </div>
    </div>
  );
}