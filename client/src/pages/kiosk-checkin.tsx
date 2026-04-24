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
  checkInType?: string;
  guestName?: string;
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

// Guest waiver form schema
const guestWaiverSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  waiverAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to the waiver to continue",
  }),
});

type GuestWaiverFormData = z.infer<typeof guestWaiverSchema>;

interface WaiverQuestion {
  id: number;
  question: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface GuestWaiverFormProps {
  onSuccess: (guestName: string) => void;
  onCancel: () => void;
}

function GuestWaiverForm({ onSuccess, onCancel }: GuestWaiverFormProps) {
  const { toast } = useToast();
  const [showWaiverText, setShowWaiverText] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, boolean>>({});

  const { data: waiverQuestions = [] } = useQuery<WaiverQuestion[]>({
    queryKey: ["/api/waiver-questions"],
    staleTime: 5 * 60 * 1000,
  });
  
  const form = useForm<GuestWaiverFormData>({
    resolver: zodResolver(guestWaiverSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      waiverAgreed: false,
    },
  });

  const guestWaiverMutation = useMutation({
    mutationFn: async (data: GuestWaiverFormData) => {
      const answers = waiverQuestions.map(q => ({
        questionId: q.id,
        answer: questionAnswers[q.id] ?? false,
      }));
      const response = await apiRequest("POST", "/api/kiosk/guest-waiver", { ...data, answers });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      onSuccess(variables.firstName);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sign waiver",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GuestWaiverFormData) => {
    // Validate required questions
    const unansweredRequired = waiverQuestions.filter(q => q.isRequired && !questionAnswers[q.id]);
    if (unansweredRequired.length > 0) {
      toast({
        title: "Required Questions",
        description: `Please answer all required questions before continuing.`,
        variant: "destructive",
      });
      return;
    }
    guestWaiverMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-lg text-muted-foreground">
          Please complete this form and sign the waiver to check in as a guest
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter first name..." 
                      {...field} 
                      className="text-lg py-5"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter last name..." 
                      {...field} 
                      className="text-lg py-5"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input 
                    type="email"
                    placeholder="Enter email address..." 
                    {...field} 
                    className="text-lg py-5"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="tel"
                    placeholder="Enter phone number..." 
                    {...field} 
                    className="text-lg py-5"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dynamic waiver questions */}
          {waiverQuestions.length > 0 && (
            <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 space-y-3">
              <h4 className="font-semibold text-blue-800">Quick Questions</h4>
              {waiverQuestions.map(q => (
                <div key={q.id} className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id={`wq-${q.id}`}
                    checked={questionAnswers[q.id] ?? false}
                    onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.checked }))}
                    className="h-5 w-5 mt-0.5 rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="leading-none">
                    <label htmlFor={`wq-${q.id}`} className="text-blue-900 font-medium cursor-pointer text-base">
                      {q.question}
                      {q.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {q.description && (
                      <p className="text-sm text-blue-600 mt-0.5">{q.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Waiver Agreement Section */}
          <div className="border rounded-xl p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-amber-800">Liability Waiver</h4>
              <Button
                type="button"
                variant="link"
                onClick={() => setShowWaiverText(!showWaiverText)}
                className="text-amber-700"
              >
                {showWaiverText ? "Hide" : "Read Full Waiver"}
              </Button>
            </div>
            
            {showWaiverText && (
              <div className="text-sm text-amber-900 bg-white border border-amber-200 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                <p className="mb-2">
                  <strong>WOLF MOTHER WELLNESS LIABILITY WAIVER AND RELEASE</strong>
                </p>
                <p className="mb-2">
                  By signing this waiver, I acknowledge and agree to the following:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>I understand that the use of thermal pools, saunas, and other wellness facilities involves inherent risks.</li>
                  <li>I am in good physical health and have no medical conditions that would prevent me from safely using these facilities.</li>
                  <li>I agree to follow all posted rules and staff instructions.</li>
                  <li>I release Wolf Mother Wellness, its owners, employees, and agents from any liability for injuries or damages that may occur during my visit.</li>
                  <li>I am at least 18 years of age or have parental/guardian consent.</li>
                  <li>I understand that alcohol consumption is prohibited before using the facilities.</li>
                </ul>
                <p className="mt-2">
                  This waiver is valid for this visit only.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="waiverAgreed"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-5 w-5 mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-amber-900 font-medium cursor-pointer">
                      I have read and agree to the liability waiver
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 py-5 text-lg"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={guestWaiverMutation.isPending}
              className="flex-1 py-5 text-lg bg-amber-500 hover:bg-amber-600 text-white"
            >
              {guestWaiverMutation.isPending ? "Signing..." : "Sign Waiver & Check In"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function KioskCheckIn() {
  const [scannerMode, setScannerMode] = useState<'waiting' | 'manual-entry' | 'confirmation' | 'success' | 'error' | 'new-purchase' | 'guest-waiver'>('waiting');
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [manualSearchTerm, setManualSearchTerm] = useState("");
  // Unified purchase flow state
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
  const [selectedPurchaseMember, setSelectedPurchaseMember] = useState<ExistingMember | null>(null);
  const [purchaseType, setPurchaseType] = useState<'membership' | 'daypass' | null>(null);
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

  // Unified purchase search for existing members
  const { data: purchaseSearchResults, isLoading: purchaseSearchLoading } = useQuery({
    queryKey: ['/api/kiosk/search-member', purchaseSearchTerm, 'purchase'],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/search-member?query=${encodeURIComponent(purchaseSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Member not found');
      return await res.json();
    },
    enabled: scannerMode === 'new-purchase' && purchaseSearchTerm.trim().length >= 3 && !selectedPurchaseMember && !purchaseType,
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
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-punch-cards"] });
        queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
        
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
    setPurchaseSearchTerm("");
    setSelectedPurchaseMember(null);
    setPurchaseType(null);
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
    setPurchaseSearchTerm("");
    setSelectedPurchaseMember(null);
    setPurchaseType(null);
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

  // Show purchase form when member and purchase type are selected
  if (purchaseType) {
    return (
      <KioskMemberCreation
        onBack={() => {
          setPurchaseType(null);
          if (!selectedPurchaseMember) {
            // Was creating new member, go back to purchase flow
            setScannerMode('new-purchase');
          }
          // Otherwise stay at member selection
        }}
        onSuccess={() => {
          setSelectedPurchaseMember(null);
          setPurchaseSearchTerm("");
          setPurchaseType(null);
          setScannerMode('waiting');
        }}
        existingMember={selectedPurchaseMember || undefined}
        dayPassOnly={purchaseType === 'daypass'}
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
              {scannerMode === 'new-purchase' && <UserPlus className="h-16 w-16 text-primary" />}
              {scannerMode === 'guest-waiver' && <User className="h-16 w-16 text-amber-500" />}
            </div>
            <CardTitle className="text-3xl font-heading font-bold">
              {scannerMode === 'waiting' && 'Ready to Check In'}
              {scannerMode === 'manual-entry' && 'Member Search'}
              {scannerMode === 'confirmation' && 'Choose Check-In Method'}
              {scannerMode === 'success' && (scanResult?.checkInType === 'guest-waiver' ? 'Checked In!' : 'Welcome Back!')}
              {scannerMode === 'error' && 'Check-In Issue'}
              {scannerMode === 'new-purchase' && 'New Purchase'}
              {scannerMode === 'guest-waiver' && 'Guest Check-In'}
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
                
                <Button 
                  onClick={() => setScannerMode('new-purchase')}
                  variant="outline"
                  size="lg"
                  className="border-2 border-primary text-primary hover:bg-primary/10 text-xl font-semibold py-6 w-full mt-4"
                  data-testid="button-new-purchase"
                >
                  <UserPlus className="h-6 w-6 mr-3" />
                  New Purchase
                </Button>
                
                <Button 
                  onClick={() => setScannerMode('guest-waiver')}
                  variant="outline"
                  size="lg"
                  className="border-2 border-amber-500 text-amber-600 hover:bg-amber-50 text-xl font-semibold py-6 w-full mt-4"
                  data-testid="button-guest-checkin"
                >
                  <User className="h-6 w-6 mr-3" />
                  Guest Check-In (Waiver Only)
                </Button>
                
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

            {/* New Purchase State - Unified flow for searching/creating members and choosing purchase type */}
            {scannerMode === 'new-purchase' && !selectedPurchaseMember && (
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
                    value={purchaseSearchTerm}
                    onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                    className="text-lg py-6"
                    data-testid="input-purchase-search"
                    autoFocus
                  />
                  
                  {purchaseSearchLoading && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Searching...</p>
                    </div>
                  )}
                  
                  {/* Search Results */}
                  {purchaseSearchResults?.members && purchaseSearchResults.members.length > 0 && (
                    <div className="border rounded-xl overflow-hidden bg-white shadow-lg max-h-60 overflow-y-auto">
                      {purchaseSearchResults.members.map((member: {
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
                            setSelectedPurchaseMember({
                              id: member.id,
                              firstName: member.firstName,
                              lastName: member.lastName,
                              email: member.email,
                              phoneNumber: member.phoneNumber,
                            });
                          }}
                          className="w-full text-left p-4 hover:bg-primary/10 border-b last:border-b-0 transition-colors"
                          data-testid={`purchase-member-${member.id}`}
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
                  {purchaseSearchResults?.members && purchaseSearchResults.members.length === 0 && purchaseSearchTerm.length >= 3 && (
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
                    onClick={() => setPurchaseType('membership')}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Member
                  </Button>
                </div>
              </div>
            )}

            {/* Purchase Type Selection - When existing member is selected */}
            {scannerMode === 'new-purchase' && selectedPurchaseMember && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="bg-primary/5 rounded-xl p-4 mb-4">
                    <p className="text-sm text-muted-foreground">Selected Member</p>
                    <p className="text-xl font-bold text-foreground">
                      {selectedPurchaseMember.firstName} {selectedPurchaseMember.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedPurchaseMember.email}</p>
                  </div>
                  <p className="text-lg text-muted-foreground">
                    What would you like to purchase?
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={() => setPurchaseType('membership')}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-white py-8 text-lg font-semibold"
                  >
                    <Crown className="h-6 w-6 mr-2" />
                    Membership
                  </Button>
                  
                  <Button 
                    onClick={() => setPurchaseType('daypass')}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white py-8 text-lg font-semibold"
                  >
                    <Sparkles className="h-6 w-6 mr-2" />
                    Day Pass
                  </Button>
                </div>
                
                <div className="flex justify-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedPurchaseMember(null);
                      setPurchaseSearchTerm("");
                    }}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Search
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
                {scanResult.checkInType === 'guest-waiver' ? (
                  /* Guest check-in success */
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-green-800 mb-2">
                      Welcome, {scanResult.guestName}!
                    </h3>
                    <div className="flex items-center justify-center mb-4">
                      <Sparkles className="h-6 w-6 text-green-600 mr-2" />
                      <span className="text-lg text-green-700">You're checked in</span>
                      <Sparkles className="h-6 w-6 text-green-600 ml-2" />
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-base px-4 py-1">
                      Guest Visit
                    </Badge>
                  </div>
                ) : (
                  /* Member check-in success */
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
                )}

                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>Checked in at {new Date().toLocaleTimeString()}</span>
                </div>
                
                <p className="text-muted-foreground">
                  You may now proceed to the changing area
                </p>
              </div>
            )}

            {/* Guest Waiver State */}
            {scannerMode === 'guest-waiver' && (
              <GuestWaiverForm 
                onSuccess={(guestName) => {
                  setScannerMode('success');
                  setScanResult({
                    success: true,
                    message: `Welcome, ${guestName}! You're all checked in.`,
                    checkInType: 'guest-waiver',
                    guestName,
                  });
                }}
                onCancel={resetToWaiting}
              />
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