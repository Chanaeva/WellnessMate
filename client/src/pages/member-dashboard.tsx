import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Membership, CheckIn, MembershipPlan, PunchCard, Notification, PaymentMethod, Payment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import MemberCard from "@/components/dashboard/member-card";
import StatsCard from "@/components/dashboard/stats-card";
import ScheduleItem from "@/components/dashboard/schedule-item";
import { Link } from "wouter";
import { 
  QrCode, 
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
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AddPaymentMethod } from "@/components/payment/add-payment-method";
import { PaymentMethodCard } from "@/components/payment/payment-method-card";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

export default function MemberDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [purchasingPunchCardId, setPurchasingPunchCardId] = useState<string | null>(null);
  const [showPaymentMethodAlert, setShowPaymentMethodAlert] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [isUpdatingPaymentMethod, setIsUpdatingPaymentMethod] = useState(false);

  // Fetch membership data
  const { data: membership, isLoading: isMembershipLoading } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
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

  // Fetch user's punch cards
  const { data: userPunchCards } = useQuery<PunchCard[]>({
    queryKey: ["/api/punch-cards"],
    enabled: !!user,
  });

  // Fetch punch card options
  const { data: punchCardOptions } = useQuery<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]>({
    queryKey: ["/api/punch-cards/options"],
  });

  // Fetch active notifications
  const { data: activeNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/active"],
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
  });

  // Fetch payment history
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  // Purchase membership mutation
  const purchaseMembershipMutation = useMutation({
    mutationFn: async (plan: MembershipPlan) => {
      // Create payment intent
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: plan.monthlyPrice / 100,
        description: `Wolf Mother Wellness - ${plan.name}`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // Confirm payment and create membership
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${plan.name}`,
        planType: plan.planType
      });
      
      if (!confirmRes.ok) {
        throw new Error('Payment confirmation failed');
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
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: punchCardData.totalPrice / 100,
        description: `Wolf Mother Wellness - ${punchCardData.name}`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // Confirm payment and create punch card
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${punchCardData.name}`
      });
      
      if (!confirmRes.ok) {
        throw new Error('Payment confirmation failed');
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

  // Helper functions for notification styling
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'announcement': return 'border-blue-500 bg-blue-50';
      case 'maintenance': return 'border-orange-500 bg-orange-50';
      case 'promotion': return 'border-green-500 bg-green-50';
      case 'alert': return 'border-red-500 bg-red-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement': return '📢';
      case 'maintenance': return '🔧';
      case 'promotion': return '⭐';
      case 'alert': return '⚠️';
      default: return '📌';
    }
  };

  // Calculate membership status and information
  const membershipStatus = membership?.status || "inactive";
  const membershipEndDate = membership ? new Date(membership.endDate) : new Date();
  const formattedEndDate = membership ? format(membershipEndDate, "MMMM d, yyyy") : "N/A";
  const currentPlan = membershipPlans?.find(plan => plan.planType === membership?.planType);
  


  // Calculate total check-ins this month
  const currentMonth = new Date().getMonth();
  const checkInsThisMonth = checkIns?.filter(checkIn => {
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
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative h-full p-6 flex items-end">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading text-white">
                      Welcome back, {user?.firstName || "Member"}!
                    </h1>
                    <p className="text-white/90 font-medium">
                      Your membership is {membershipStatus === "active" ? "active until" : "expired on"} {formattedEndDate}
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 flex justify-between items-center bg-card">
                <div>
                  <div className="text-sm text-muted-foreground">Recent Check-ins</div>
                  <div className="text-xl font-semibold text-foreground">{checkInsThisMonth} this month</div>
                </div>
                <div>
                  <Link href="/qr-code">
                    <Button className="wellness-button-primary flex items-center">
                      <QrCode className="mr-2 h-4 w-4" /> Check In Now
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Plans and Packages Link */}
            <Card className="wellness-card">
              <CardHeader className="text-center">
                <CardTitle className="text-lg sm:text-xl md:text-2xl font-heading text-foreground flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Membership Plans & Packages
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Explore our monthly memberships and day pass packages designed for your wellness journey.
                </p>
                <Link href="/packages">
                  <Button className="wellness-button-primary px-8 py-3 text-lg">
                    View Plans & Packages
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Facilities */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-heading mb-6 text-foreground">Our Thermal Facilities</h2>
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
                      <h4 className="font-semibold text-foreground">Finnish Saunas</h4>
                      <p className="text-sm text-muted-foreground mt-1">Open 24/7 • Traditional dry heat therapy</p>
                      <Badge className="thermal-badge-primary mt-2">Available</Badge>
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
                      <h4 className="font-semibold text-foreground">Cold Plunge Pools</h4>
                      <p className="text-sm text-muted-foreground mt-1">Invigorating cold therapy • Health benefits</p>
                      <Badge className="thermal-badge-info mt-2">Available</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Thermal Wellness Benefits */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-heading mb-6 text-foreground">Thermal Wellness Benefits</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Improved Circulation</h4>
                      <p className="text-sm text-muted-foreground mt-1">Regular sauna sessions can improve cardiovascular health and blood flow</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-secondary/10 p-3 rounded-xl">
                      <Sparkles className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Stress Reduction</h4>
                      <p className="text-sm text-muted-foreground mt-1">Thermal therapy helps reduce cortisol levels and promotes relaxation</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-accent/10 p-3 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Immune System Support</h4>
                      <p className="text-sm text-muted-foreground mt-1">Hot and cold contrast therapy can help strengthen your immune response</p>
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
            />

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethods && paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{method.cardBrand} ending in {method.cardLast4}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {method.cardExpMonth}/{method.cardExpYear}
                          </p>
                        </div>
                        <div className="text-right">
                          {method.isDefault && (
                            <Badge variant="default" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No payment methods added yet</p>
                    <Button onClick={() => setShowAddPaymentMethod(true)} className="wellness-button-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </div>
                )}

                {paymentMethods && paymentMethods.length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddPaymentMethod(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Card
                  </Button>
                )}

                {showAddPaymentMethod && (
                  <div className="mt-6">
                    <Elements stripe={stripePromise}>
                      <AddPaymentMethod
                        isUpdating={isUpdatingPaymentMethod}
                        onSuccess={() => {
                          setShowAddPaymentMethod(false);
                          setIsUpdatingPaymentMethod(false);
                          queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
                        }}
                        onCancel={() => {
                          setShowAddPaymentMethod(false);
                          setIsUpdatingPaymentMethod(false);
                        }}
                      />
                    </Elements>
                  </div>
                )}
              </CardContent>
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
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{payment.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.transactionDate ? format(new Date(payment.transactionDate), "MMM d, yyyy 'at' h:mm a") : 'Date not available'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ${(payment.amount / 100).toFixed(2)}
                          </p>
                          <p className={`text-xs ${payment.status === 'successful' ? 'text-green-600' : 'text-red-600'}`}>
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

            {/* Day Pass Packages - Show when purchased */}
            {userPunchCards && userPunchCards.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl font-heading flex items-center">
                    <Ticket className="h-5 w-5 text-amber-600 mr-2" />
                    Your Day Pass Packages
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-3">
                    {userPunchCards.map((card) => (
                      <div key={card.id} className="border-2 border-secondary/30 bg-gradient-to-br from-secondary/20 to-accent/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{card.name}</h4>
                          <Badge className={`${card.status === 'active' ? 'bg-success text-success-foreground' : card.status === 'exhausted' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {card.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className="font-bold text-primary">{card.remainingPunches} visits</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="text-foreground">{card.totalPunches} visits</span>
                        </div>
                        {card.status === 'active' && (
                          <div className="mt-3">
                            <Link href="/qr-code">
                              <Button size="sm" className="w-full wellness-button-primary">
                                Use for Check-in
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg sm:text-xl font-heading mb-4">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Link href="/qr-code">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <QrCode className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">View Code</span>
                    </Button>
                  </Link>
                  <Link href="/payments">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <CreditCard className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">Payments</span>
                    </Button>
                  </Link>
                  <Link href="/membership">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <Users className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">Membership</span>
                    </Button>
                  </Link>
                </div>
                
                {/* External Links Section */}
                <div className="border-t border-border pt-4">
                  <a 
                    href="https://www.wolfmothertulsa.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" className="w-full flex items-center justify-center bg-primary/5 hover:bg-primary/10 py-3 border-primary/20">
                      <svg className="h-5 w-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                      </svg>
                      <span className="text-sm text-primary font-medium">Visit Our Website</span>
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

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
                          <span className="text-sm">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm text-foreground">{notification.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(notification.startDate), "MMM d, yyyy 'at' h:mm a")}
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
      <AlertDialog open={showPaymentMethodAlert} onOpenChange={setShowPaymentMethodAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Payment Method Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You need to add a payment method before making any purchases. This helps us process your membership or day pass orders securely.
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
    </div>
  );
}
