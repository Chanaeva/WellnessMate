import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Membership,
  CheckIn,
  MembershipPlan,
  PunchCard,
  Notification,
  PaymentMethod,
  Payment,
  SessionConfig,
  SessionBooking,
  HoursOfOperation,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MemberCard from "@/components/dashboard/member-card";
import { Link } from "wouter";
import {
  Calendar,
  Users,
  Settings,
  CreditCard,
  ArrowRight,
  CheckCircle,
  XCircle,
  Volleyball,
  Heart,
  Sparkles,
  Ticket,
  ShoppingCart,
  Crown,
  Star,
  Zap,
  Check,
  Loader2,
  Plus,
  Trash2,
  Shield,
  DollarSign,
  AlertTriangle,
  FileText,
  Download,
  Sun,
  Moon,
  Clock,
  CalendarCheck,
} from "lucide-react";
import { format } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AddPaymentMethod } from "@/components/payment/add-payment-method";
import { PaymentMethodCard } from "@/components/payment/payment-method-card";

// Initialize Stripe - fetch key from backend to ensure correct environment key is used
const stripePromise = fetch("/api/stripe/config")
  .then((res) => res.json())
  .then(({ publicKey }) => loadStripe(publicKey));

export default function MemberDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [purchasingPunchCardId, setPurchasingPunchCardId] = useState<
    string | null
  >(null);
  const [showPaymentMethodAlert, setShowPaymentMethodAlert] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [isUpdatingPaymentMethod, setIsUpdatingPaymentMethod] = useState(false);
  const [showCancelMembershipDialog, setShowCancelMembershipDialog] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  // Check if we should auto-open add payment form from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("add-payment") === "true") {
      setShowAddPaymentMethod(true);
      // Clean up URL without causing navigation
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Fetch membership data with automatic refetching
  const { data: membership, isLoading: isMembershipLoading, refetch: refetchMembership } =
    useQuery<Membership>({
      queryKey: ["/api/membership"],
      enabled: !!user,
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchOnWindowFocus: true, // Refetch when window gains focus
      refetchOnMount: true, // Always refetch on mount
    });

  // Fetch check-ins data
  const { data: checkIns, isLoading: isCheckInsLoading } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Fetch user's punch cards with automatic refetching
  const { data: userPunchCards, refetch: refetchPunchCards } = useQuery<PunchCard[]>({
    queryKey: ["/api/punch-cards"],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
  });

  // Fetch punch card options
  const { data: punchCardOptions } = useQuery<
    {
      name: string;
      totalPunches: number;
      totalPrice: number;
      pricePerPunch: number;
    }[]
  >({
    queryKey: ["/api/punch-cards/options"],
  });

  // Fetch active notifications
  const { data: activeNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/active"],
  });

  // Fetch payment methods with automatic refetching
  const { data: paymentMethods, refetch: refetchPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Fetch payment history
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  // Fetch checked-out items
  const { data: checkedOutItems = [] } = useQuery<any[]>({
    queryKey: ["/api/checkouts/my-items"],
    enabled: !!user,
  });

  // Fetch available sessions
  const { data: availableSessions = [] } = useQuery<SessionConfig[]>({
    queryKey: ["/api/sessions"],
    enabled: !!user,
  });

  // Fetch user's session bookings
  const { data: mySessionBookings = [] } = useQuery<SessionBooking[]>({
    queryKey: ["/api/session-bookings"],
    enabled: !!user,
  });

  // Fetch hours of operation to check for closed days
  const { data: hoursOfOperation = [] } = useQuery<HoursOfOperation[]>({
    queryKey: ["/api/hours-of-operation"],
    enabled: !!user,
  });

  // Helper function to check if a date is closed
  const isDateClosed = (dateString: string): boolean => {
    const date = new Date(dateString + 'T12:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    const dayHours = hoursOfOperation.find(h => h.dayOfWeek === dayOfWeek);
    return dayHours?.isClosed ?? false;
  };
  
  // Fetch billing info from Stripe (for correct next billing date)
  const { data: billingInfo } = useQuery<{
    nextBillingDate: string;
    source: string;
    subscriptionStatus?: string;
    cancelAtPeriodEnd?: boolean;
  }>({
    queryKey: ["/api/membership/billing-info"],
    enabled: !!user && !!membership,
  });

  // Listen for purchase completion events from checkout page (after all queries are declared)
  useEffect(() => {
    // Listen for purchase completion events from checkout page
    const handlePurchaseComplete = () => {
      // Show immediate feedback
      toast({
        title: "Updating Membership",
        description: "Refreshing your membership details...",
      });
      
      // Refetch all membership-related data when a purchase is completed
      setTimeout(() => {
        refetchMembership();
        refetchPunchCards();
        refetchPaymentMethods();
        queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
        queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      }, 2000); // Wait 2 seconds for backend to process
    };

    // Listen for storage events (when checkout page sets completion flag)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'purchase_completed' && e.newValue === 'true') {
        handlePurchaseComplete();
        // Clear the flag
        localStorage.removeItem('purchase_completed');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check on focus in case we missed the storage event
    const handleFocus = () => {
      if (localStorage.getItem('purchase_completed') === 'true') {
        handlePurchaseComplete();
        localStorage.removeItem('purchase_completed');
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchMembership, refetchPunchCards, refetchPaymentMethods, toast]);

  // Purchase membership mutation
  const purchaseMembershipMutation = useMutation({
    mutationFn: async (plan: MembershipPlan) => {
      // Create payment intent
      const paymentIntentRes = await apiRequest(
        "POST",
        "/api/create-payment-intent",
        {
          amount: plan.monthlyPrice / 100,
          description: `Wolf Mother Wellness - ${plan.name}`,
        },
      );
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // Confirm payment and create membership
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${plan.name}`,
        planType: plan.planType,
      });

      if (!confirmRes.ok) {
        throw new Error("Payment confirmation failed");
      }

      return await confirmRes.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Purchased!",
        description: "Your membership has been activated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase membership",
        variant: "destructive",
      });
    },
  });

  // Helper function to check if user has a payment method
  const hasPaymentMethod = paymentMethods && paymentMethods.length > 0;

  // Handle purchase attempts
  const handlePurchaseAttempt = (punchCardData: any) => {
    if (!hasPaymentMethod) {
      setShowPaymentMethodAlert(true);
      return;
    }
    purchasePunchCardMutation.mutate(punchCardData);
  };

  // Handle membership purchase attempts
  const handleMembershipPurchaseAttempt = (plan: MembershipPlan) => {
    if (!hasPaymentMethod) {
      setShowPaymentMethodAlert(true);
      return;
    }
    purchaseMembershipMutation.mutate(plan);
  };

  // Handle redirect to payments page
  const handleAddPaymentMethod = () => {
    setShowPaymentMethodAlert(false);
    setShowAddPaymentMethod(true);
  };

  // Purchase punch card mutation
  const purchasePunchCardMutation = useMutation({
    mutationFn: async (punchCardData: any) => {
      setPurchasingPunchCardId(punchCardData.name);

      // Create payment intent
      const paymentIntentRes = await apiRequest(
        "POST",
        "/api/create-payment-intent",
        {
          amount: punchCardData.totalPrice / 100,
          description: `Wolf Mother Wellness - ${punchCardData.name}`,
        },
      );
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // Confirm payment and create punch card
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${punchCardData.name}`,
      });

      if (!confirmRes.ok) {
        throw new Error("Payment confirmation failed");
      }

      // Create punch card
      const punchCardRes = await apiRequest("POST", "/api/punch-cards", {
        name: punchCardData.name,
        totalPunches: punchCardData.totalPunches,
        remainingPunches: punchCardData.totalPunches,
        pricePerPunch: punchCardData.pricePerPunch,
        totalPrice: punchCardData.totalPrice,
      });

      return await punchCardRes.json();
    },
    onSuccess: () => {
      setPurchasingPunchCardId(null);
      toast({
        title: "Punch Card Purchased!",
        description: "Your punch card has been added to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error: any) => {
      setPurchasingPunchCardId(null);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase punch card",
        variant: "destructive",
      });
    },
  });

  // Cancel membership mutation
  const cancelMembershipMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/membership/cancel");
      if (!response.ok) {
        throw new Error("Failed to cancel membership");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
      setShowCancelMembershipDialog(false);
      toast({
        title: "Membership Cancelled",
        description: "Your membership has been cancelled effective immediately. No prorated refund will be issued.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel membership",
        variant: "destructive",
      });
    },
  });

  // Book session mutation
  const bookSessionMutation = useMutation({
    mutationFn: async ({ date, sessionType }: { date: string; sessionType: 'morning' | 'evening' }) => {
      const response = await apiRequest("POST", "/api/session-bookings", {
        bookingDate: date,
        sessionType,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to book session");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session-bookings"] });
      toast({
        title: "Session Booked!",
        description: "Your session has been reserved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book session",
        variant: "destructive",
      });
    },
  });

  // Cancel session booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest("DELETE", `/api/session-bookings/${bookingId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel booking");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session-bookings"] });
      toast({
        title: "Booking Cancelled",
        description: "Your session booking has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  // Helper functions for notification styling
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "announcement":
        return "border-blue-500 bg-blue-50";
      case "maintenance":
        return "border-orange-500 bg-orange-50";
      case "promotion":
        return "border-green-500 bg-green-50";
      case "alert":
        return "border-red-500 bg-red-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return "📢";
      case "maintenance":
        return "🔧";
      case "promotion":
        return "⭐";
      case "alert":
        return "⚠️";
      default:
        return "📌";
    }
  };

  // Calculate membership status and information
  const membershipStatus = membership?.status || "inactive";
  
  // Use billing info from Stripe if available, otherwise fall back to database endDate
  const nextBillingDateStr = billingInfo?.nextBillingDate || membership?.endDate;
  const membershipEndDate = nextBillingDateStr
    ? new Date(nextBillingDateStr)
    : new Date();
  const formattedEndDate = membership
    ? format(membershipEndDate, "MMMM d, yyyy")
    : "N/A";
  const currentPlan = membershipPlans?.find(
    (plan) => plan.planType === membership?.planType,
  );

  // Calculate total check-ins this month
  const currentMonth = new Date().getMonth();
  const checkInsThisMonth =
    checkIns?.filter((checkIn) => {
      if (!checkIn.timestamp) return false;
      const checkInDate = new Date(checkIn.timestamp.toString());
      return checkInDate.getMonth() === currentMonth;
    }).length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-grow wellness-container py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column (2/3) */}
          <div className="md:w-2/3 space-y-6">
            {/* Welcome Banner */}
            <Card className="wellness-card overflow-hidden">
              <div className="h-40 thermal-gradient relative">
                <div className="absolute inset-0 bg-black/5"></div>
                <div className="relative h-full p-6 flex items-end">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading text-white">
                      Welcome back, {user?.firstName || "Member"}!
                    </h1>
                    <p className="text-white/90 font-medium">
                      Your membership is{" "}
                      {membershipStatus === "active"
                        ? "active until"
                        : "expired on"}{" "}
                      {formattedEndDate}
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 flex justify-between items-center bg-card">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Recent Check-ins
                  </div>
                  <div className="text-xl font-semibold text-foreground">
                    {checkInsThisMonth} this month
                  </div>
                </div>
                <div>
                  <Link href="/packages">
                    <Button className="wellness-button-primary flex items-center">
                      View Plans
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Session Booking Section */}
            {membership?.status === "active" && availableSessions.length > 0 && (
              <Card className="wellness-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading text-foreground flex items-center">
                    <CalendarCheck className="h-5 w-5 mr-2" />
                    Book Your Session
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Reserve your spot for a morning or evening session to secure your preferred time.
                  </p>
                  
                  {/* Date Selector */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Select Date:</label>
                    <input
                      type="date"
                      value={selectedBookingDate}
                      onChange={(e) => setSelectedBookingDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="border rounded-md px-3 py-2 text-sm bg-background"
                    />
                  </div>

                  {/* Session Cards */}
                  {isDateClosed(selectedBookingDate) ? (
                    <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed">
                      <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-lg font-medium text-muted-foreground">Closed</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        We are closed on this day. Please select a different date.
                      </p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {availableSessions.map((session) => {
                      const existingBooking = mySessionBookings.find(
                        (b) => b.bookingDate === selectedBookingDate && b.sessionType === session.sessionType && b.status !== 'cancelled'
                      );
                      const isBooked = !!existingBooking;
                      const Icon = session.sessionType === 'morning' ? Sun : Moon;
                      const bgColor = session.sessionType === 'morning' 
                        ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' 
                        : 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800';
                      const iconColor = session.sessionType === 'morning'
                        ? 'text-amber-500'
                        : 'text-indigo-500';

                      return (
                        <div 
                          key={session.id} 
                          className={`p-4 rounded-lg border ${bgColor} space-y-3`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                            <span className="font-semibold capitalize">
                              {session.sessionType} Session
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{session.startTime} - {session.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>Capacity: {session.capacity}</span>
                          </div>
                          
                          {isBooked ? (
                            <div className="space-y-2">
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Booked
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => existingBooking && cancelBookingMutation.mutate(existingBooking.id)}
                                disabled={cancelBookingMutation.isPending}
                              >
                                {cancelBookingMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <XCircle className="h-4 w-4 mr-2" />
                                )}
                                Cancel Booking
                              </Button>
                            </div>
                          ) : (
                            <Button
                              className="w-full wellness-button-primary"
                              onClick={() => bookSessionMutation.mutate({
                                date: selectedBookingDate,
                                sessionType: session.sessionType as 'morning' | 'evening'
                              })}
                              disabled={bookSessionMutation.isPending}
                            >
                              {bookSessionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <CalendarCheck className="h-4 w-4 mr-2" />
                              )}
                              Book Session
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {/* Upcoming Bookings */}
                  {mySessionBookings.filter(b => b.status !== 'cancelled' && new Date(b.bookingDate) >= new Date(format(new Date(), 'yyyy-MM-dd'))).length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Your Upcoming Bookings</h4>
                      <div className="space-y-2">
                        {mySessionBookings
                          .filter(b => b.status !== 'cancelled' && new Date(b.bookingDate) >= new Date(format(new Date(), 'yyyy-MM-dd')))
                          .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())
                          .slice(0, 5)
                          .map((booking) => {
                            const session = availableSessions.find(s => s.sessionType === booking.sessionType);
                            const Icon = booking.sessionType === 'morning' ? Sun : Moon;
                            return (
                              <div 
                                key={booking.id}
                                className="flex items-center justify-between p-2 rounded bg-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span className="font-medium">
                                    {format(new Date(booking.bookingDate), "EEE, MMM d")}
                                  </span>
                                  <span className="text-sm text-muted-foreground capitalize">
                                    {booking.sessionType} ({session?.startTime} - {session?.endTime})
                                  </span>
                                </div>
                                <Badge 
                                  variant={booking.status === 'checked_in' ? 'default' : 'secondary'}
                                  className={booking.status === 'checked_in' ? 'bg-green-600' : ''}
                                >
                                  {booking.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                                </Badge>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Checked Out Items */}
            {checkedOutItems && checkedOutItems.length > 0 && (
              <Card className="wellness-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading text-foreground flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Checked Out Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {checkedOutItems.map((checkout: any) => (
                      <div 
                        key={checkout.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        data-testid={`member-checkout-${checkout.id}`}
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {checkout.item?.name} {checkout.item?.size && `(${checkout.item.size})`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Checked out {new Date(checkout.checkedOutAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary">Out</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Return items to the front desk when you're done
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Membership Agreement Download - Show if agreement is completed */}
            {user?.membershipAgreementCompleted && (
              <Card className="wellness-card">
                <CardHeader>
                  <CardTitle className="text-lg font-heading text-foreground flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Membership Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download a copy of your signed membership agreement and waiver.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open('/api/membership-agreement/pdf', '_blank');
                    }}
                    className="flex items-center"
                    data-testid="download-agreement-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Plans and Packages Link - Show if no active membership */}
            {(!membership || membership.status !== "active") && (
              <Card className="wellness-card">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-heading text-foreground flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Membership Plans & Packages
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-muted-foreground pb-4">
                    Explore our monthly memberships and day pass packages
                    designed for your wellness journey.
                  </p>
                  <Link href="/packages">
                    <Button className="wellness-button-primary px-8 py-3 text-lg">
                      View Plans & Packages
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Facilities */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-heading mb-6 text-foreground">
                  Our Thermal Facilities
                </h2>
                <div className="wellness-grid">
                  {/* Facility Item 1 */}
                  <div className="wellness-card overflow-hidden">
                    <div className="h-32 thermal-gradient relative">
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative h-full flex items-center justify-center">
                        <Heart className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground">
                        Finnish Saunas
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Open 24/7 • Traditional dry heat therapy
                      </p>
                      <Badge className="thermal-badge-primary mt-2">
                        Available
                      </Badge>
                    </div>
                  </div>

                  {/* Facility Item 2 */}
                  <div className="wellness-card overflow-hidden">
                    <div className="h-32 cold-gradient relative">
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative h-full flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground">
                        Cold Plunge Pools
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Invigorating cold therapy • Health benefits
                      </p>
                      <Badge className="thermal-badge-info mt-2">
                        Available
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Thermal Wellness Benefits */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-heading mb-6 text-foreground">
                  Thermal Wellness Benefits
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Improved Circulation
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Regular sauna sessions can improve cardiovascular health
                        and blood flow
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-secondary/10 p-3 rounded-xl">
                      <Sparkles className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Stress Reduction
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Thermal therapy helps reduce cortisol levels and
                        promotes relaxation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-accent/10 p-3 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Immune System Support
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Hot and cold contrast therapy can help strengthen your
                        immune response
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1/3) */}
          <div className="md:w-1/3 space-y-6">
            {/* Membership Card */}
            <MemberCard
              user={user}
              membership={membership}
              membershipEndDate={formattedEndDate}
              planName={currentPlan?.name || "Basic Membership"}
              memberSince="Jan 2023"
              currentPlan={currentPlan}
              userPunchCards={userPunchCards}
              payments={payments}
              onCancelMembership={() => setShowCancelMembershipDialog(true)}
              isLoading={isMembershipLoading}
            />

            {/* Your Day Pass Packages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Your Day Pass Packages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userPunchCards && userPunchCards.length > 0 ? (
                  <div className="space-y-3">
                    {userPunchCards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`day-pass-card-${card.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {card.remainingPunches} of {card.totalPunches}{" "}
                            visits remaining
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${(card.pricePerPunch / 100).toFixed(2)} per visit
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              card.status === "active" ? "default" : "secondary"
                            }
                          >
                            {card.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      No day pass packages yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Purchase packages to see them here
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Link href="/packages?tab=day-passes" className="w-full">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-buy-day-passes"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Buy Day Passes
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.slice(0, 5).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {payment.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.transactionDate
                              ? format(
                                  new Date(payment.transactionDate),
                                  "MMM d, yyyy 'at' h:mm a",
                                )
                              : "Date not available"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ${(payment.amount / 100).toFixed(2)}
                          </p>
                          <p
                            className={`text-xs ${payment.status === "successful" ? "text-green-600" : "text-red-600"}`}
                          >
                            {payment.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Saved Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentMethods && paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <PaymentMethodCard
                        key={method.id}
                        paymentMethod={method}
                        showActions={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      No saved payment methods
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add a card to make purchases easier
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddPaymentMethod(true)}
                  data-testid="button-add-payment-method"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Card
                </Button>
              </CardFooter>
            </Card>

            {/* External Links Section */}
            <Card>
              <CardContent className="p-6">
                <a
                  href="https://www.wolfmothertulsa.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center bg-primary/5 hover:bg-primary/10 py-3 border-primary/20"
                  >
                    <svg
                      className="h-5 w-5 text-primary mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                      />
                    </svg>
                    <span className="text-sm text-primary font-medium">
                      Visit Our Website
                    </span>
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Conditional Plans & Packages for Active Members */}
            {membership && membership.status === "active" && (
              <Card className="wellness-card">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl font-heading text-foreground flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Explore More Plans & Packages
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    Discover additional wellness packages to enhance your
                    journey.
                  </p>
                  <Link href="/packages">
                    <Button className="wellness-button-primary px-8 py-3 text-lg">
                      View Plans & Packages
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Notifications */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Notifications</h3>
                  <Button variant="link" className="text-primary">
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {activeNotifications && activeNotifications.length > 0 ? (
                    activeNotifications.slice(0, 3).map((notification) => (
                      <div
                        key={notification.id}
                        className={`border-l-4 p-3 rounded-r-lg ${getNotificationColor(notification.type)}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-sm">
                            {getNotificationIcon(notification.type)}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm text-foreground">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(
                                new Date(notification.startDate),
                                "MMM d, yyyy 'at' h:mm a",
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No notifications at this time</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Payment Method Required Alert Dialog */}
      <AlertDialog
        open={showPaymentMethodAlert}
        onOpenChange={setShowPaymentMethodAlert}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <svg
                className="h-6 w-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              Payment Method Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You need to add a payment method before making any purchases. This
              helps us process your membership or day pass orders securely.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentMethodAlert(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <AlertDialogAction
              onClick={handleAddPaymentMethod}
              className="w-full sm:w-auto wellness-button-primary"
            >
              Add Payment Method
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Membership Dialog */}
      <AlertDialog
        open={showCancelMembershipDialog}
        onOpenChange={setShowCancelMembershipDialog}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-destructive/10 p-2 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Cancel Membership</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to cancel your membership? This action cannot be undone.
              <br/><br/>
              <strong>Important:</strong> Your membership will be cancelled immediately and no prorated refund will be issued for the remaining time on your current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel 
              onClick={() => setShowCancelMembershipDialog(false)}
              className="px-8 py-3"
            >
              Keep Membership
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => cancelMembershipMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90 text-white font-semibold px-8 py-3"
              disabled={cancelMembershipMutation.isPending}
            >
              {cancelMembershipMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Membership"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddPaymentMethod} onOpenChange={setShowAddPaymentMethod}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <Elements stripe={stripePromise}>
            <AddPaymentMethod
              onSuccess={() => {
                setShowAddPaymentMethod(false);
                refetchPaymentMethods();
              }}
              onCancel={() => setShowAddPaymentMethod(false)}
            />
          </Elements>
        </DialogContent>
      </Dialog>
    </div>
  );
}
