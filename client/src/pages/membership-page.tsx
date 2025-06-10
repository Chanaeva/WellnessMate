import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Membership, MembershipPlan } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Check, Calendar, CreditCard, AlertTriangle, Crown, ArrowRight, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

export default function MembershipPage() {
  const { user } = useAuth();

  // Fetch membership data
  const { data: membership, isLoading: isMembershipLoading } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans, isLoading: isPlansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  const currentPlan = membershipPlans?.find(plan => plan.planType === membership?.planType);
  const isActive = membership?.status === 'active';

  if (isMembershipLoading || isPlansLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow wellness-container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-display font-bold text-foreground">Your Membership</h1>
            <p className="text-xl text-muted-foreground">
              Manage your Wolf Mother Wellness membership
            </p>
          </div>

          {/* Active Membership Display */}
          {isActive && membership && currentPlan ? (
            <Card className="wellness-card overflow-hidden">
              {/* Gradient Header */}
              <div className="h-40 thermal-gradient relative">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative h-full p-8 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <Crown className="h-6 w-6 text-white" />
                      <Badge className="bg-white/20 text-white border-white/30 text-sm">
                        Active Membership
                      </Badge>
                    </div>
                    <h2 className="text-3xl font-display font-bold text-white">
                      {currentPlan.name}
                    </h2>
                    <p className="text-white/90 text-lg mt-1">
                      Member ID: {membership.membershipId}
                    </p>
                  </div>
                  <div className="text-right text-white">
                    <div className="text-white/80 text-lg">Monthly</div>
                    <div className="text-4xl font-bold">${(currentPlan.monthlyPrice / 100).toFixed(0)}</div>
                  </div>
                </div>
              </div>

              <CardContent className="p-8">
                {/* Membership Details */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Next Billing Date</span>
                      </div>
                      <span className="font-semibold">
                        {format(new Date(membership.endDate), "MMMM dd, yyyy")}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Plan Type</span>
                      </div>
                      <span className="font-semibold capitalize">{membership.planType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Status</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Active
                      </Badge>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Included Features</h3>
                    <div className="space-y-3">
                      {currentPlan.features?.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border">
                  <Link href="/payments" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" />
                      View Payment History
                    </Button>
                  </Link>
                  <Link href="/payments" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase Add-ons
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* No Active Membership */
            <Card className="wellness-card text-center">
              <CardHeader className="py-12">
                <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl mb-4">No Active Membership</CardTitle>
                <CardDescription className="text-lg">
                  You don't currently have an active membership. Purchase a plan to access all thermal wellness facilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-12">
                <Link href="/payments">
                  <Button size="lg" className="wellness-button-primary">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Browse Membership Plans
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Membership Benefits */}
          <Card className="wellness-card">
            <CardHeader>
              <CardTitle className="text-2xl">Wolf Mother Wellness Benefits</CardTitle>
              <CardDescription>
                Discover what makes our thermal wellness center special
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Finnish Saunas</h3>
                  <p className="text-sm text-muted-foreground">
                    Traditional dry heat therapy for cardiovascular health and relaxation
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Cold Plunge</h3>
                  <p className="text-sm text-muted-foreground">
                    Invigorating cold therapy to boost immunity and mental clarity
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Infrared Therapy</h3>
                  <p className="text-sm text-muted-foreground">
                    Deep tissue healing and detoxification through infrared heat
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: punchCardData.totalPrice / 100, // Convert cents to dollars
        description: `Wolf Mother Wellness - ${punchCardData.name}`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // For demo purposes, simulate successful payment
      // In a real app, this would redirect to Stripe checkout or use Stripe Elements
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Punch Card Purchase - ${punchCardData.name}`
      });
      
      if (confirmRes.ok) {
        // Create the punch card after successful payment
        const punchCardRes = await apiRequest("POST", "/api/punch-cards", punchCardData);
        return await punchCardRes.json();
      } else {
        throw new Error("Payment processing failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Purchase successful",
        description: "Your punch card has been purchased and payment recorded!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Purchase membership plan through Stripe payment
  const purchaseMembershipMutation = useMutation({
    mutationFn: async (planData: any) => {
      try {
        console.log("Starting membership purchase for:", planData);
        
        // First create a payment intent
        const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
          amount: planData.monthlyPrice / 100, // Convert cents to dollars
          description: `Wolf Mother Wellness - ${planData.name} Membership`
        });
        
        if (!paymentIntentRes.ok) {
          const errorData = await paymentIntentRes.text();
          throw new Error(`Payment intent creation failed: ${errorData}`);
        }
        
        const { clientSecret, paymentIntentId } = await paymentIntentRes.json();
        console.log("Payment intent created:", paymentIntentId);

        // For demo purposes, simulate successful payment
        const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
          paymentIntentId,
          membershipId: null,
          description: `Membership Purchase - ${planData.name}`
        });
        
        if (!confirmRes.ok) {
          const errorData = await confirmRes.text();
          throw new Error(`Payment confirmation failed: ${errorData}`);
        }
        
        console.log("Payment confirmed, updating membership");
        
        // Update membership after successful payment
        const membershipRes = await apiRequest("PATCH", "/api/membership", {
          planType: planData.planType,
          status: 'active'
        });
        
        if (!membershipRes.ok) {
          const errorData = await membershipRes.text();
          throw new Error(`Membership update failed: ${errorData}`);
        }
        
        return await membershipRes.json();
      } catch (error: any) {
        console.error("Membership purchase error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Membership updated",
        description: "Your membership has been updated and payment recorded!",
      });
    },
    onError: (error: Error) => {
      console.error("Purchase mutation error:", error);
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper function to convert cents to dollars
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Get current plan
  const currentPlan = membershipPlans?.find(plan => plan.planType === membership?.planType);

  // Filter available plans - exclude daily passes from main membership plans and current plan
  const availableMonthlyPlans = membershipPlans?.filter(plan => 
    plan.planType !== 'daily' && plan.planType !== membership?.planType
  );

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-2xl font-bold">Your Membership</CardTitle>
              <CardDescription className="text-white/80">Manage your membership details and plan</CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Current Active Plan */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-6 text-foreground">Your Active Plan</h3>
                {isMembershipLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-pulse">Loading membership details...</div>
                  </div>
                ) : membership ? (
                  <div className="wellness-card bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Badge className="bg-white/20 text-white hover:bg-white/30">
                          {membership.status === 'active' ? 'Active Membership' : membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
                        </Badge>
                        <div className="text-right">
                          <div className="text-3xl font-bold">
                            {currentPlan ? formatPrice(currentPlan.monthlyPrice) : '$0.00'}
                          </div>
                          <div className="text-sm opacity-90">/month</div>
                        </div>
                      </div>
                      
                      <h4 className="text-2xl font-bold mb-2">
                        {currentPlan?.name || 'Basic Membership'}
                      </h4>
                      <p className="text-white/90">
                        {currentPlan?.description || 'Access to basic facilities'}
                      </p>
                    </div>
                    
                    <div className="p-6">
                      <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h5 className="font-semibold text-foreground mb-3">Membership Details</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plan Type:</span>
                              <span className="font-medium">{currentPlan?.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge className={membership.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}>
                                {membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Next Billing:</span>
                              <span className="font-medium">{format(new Date(membership.endDate), "MMM d, yyyy")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Auto-Renew:</span>
                              <span className="font-medium">{membership.autoRenew ? 'Enabled' : 'Disabled'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-semibold text-foreground mb-3">Plan Features</h5>
                          <div className="space-y-2">
                            {currentPlan?.features.map((feature, index) => (
                              <div key={index} className="flex items-center text-sm">
                                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-border pt-4">
                        <div className="flex gap-3 flex-wrap">
                          <Button variant="outline" className="flex items-center hover:bg-primary/5">
                            <Edit className="mr-2 h-4 w-4" /> Change Plan
                          </Button>
                          <Button variant="outline" className="flex items-center hover:bg-primary/5">
                            <Calendar className="mr-2 h-4 w-4" /> Manage Billing
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-light rounded-lg p-6 border border-gray-200 text-center">
                    <p className="text-gray-600 mb-4">You don't have an active membership yet.</p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4">Payment Method</h3>
                <div className="bg-neutral-light rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-white p-2 rounded-md border border-gray-200 mr-3">
                        <CreditCard className="h-6 w-6 text-blue-700" />
                      </div>
                      <div>
                        <h4 className="font-medium">Visa ending in 4242</h4>
                        <p className="text-sm text-gray-500">Expires 09/2025</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="text-primary">
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
              </div>

              {/* Available Plans - Only show if user has no membership or wants to change */}
              {(!membership || availableMonthlyPlans?.length > 0) && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4">Available Plans</h3>
                  {isPlansLoading ? (
                    <div className="p-6 text-center">Loading available plans...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availableMonthlyPlans?.map((plan) => (
                        <Card key={plan.id} className="overflow-hidden">
                          <CardHeader className="p-4 bg-gray-50 border-b border-gray-200">
                            <CardTitle className="font-bold">{plan.name}</CardTitle>
                            <div className="text-2xl font-bold mt-2">
                              {formatPrice(plan.monthlyPrice)}
                              <span className="text-sm font-normal text-gray-500">/month</span>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <ul className="space-y-2">
                              {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start">
                                  <Check className="text-green-500 mr-2 mt-1 h-4 w-4 flex-shrink-0" />
                                  <span className="text-sm">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                          <CardFooter className="p-4 pt-0">
                            <Button 
                              className="w-full wellness-button-primary"
                              disabled={purchaseMembershipMutation.isPending}
                              onClick={() => purchaseMembershipMutation.mutate(plan)}
                            >
                              {purchaseMembershipMutation.isPending 
                                ? 'Processing...' 
                                : membership 
                                  ? 'Change to This Plan' 
                                  : 'Purchase Package'
                              }
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Your Punch Cards */}
              {userPunchCards && userPunchCards.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4">Your Digital Punch Cards</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userPunchCards.map((card) => (
                      <Card key={card.id} className="overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                        <CardHeader className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4">
                          <div className="flex items-center justify-between">
                            <Ticket className="h-6 w-6" />
                            <Badge className={`${card.status === 'active' ? 'bg-green-500' : card.status === 'exhausted' ? 'bg-red-500' : 'bg-gray-500'}`}>
                              {card.status}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg font-bold mt-2">{card.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Remaining Visits:</span>
                              <span className="font-bold text-lg">{card.remainingPunches} / {card.totalPunches}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${(card.remainingPunches / card.totalPunches) * 100}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Purchased: {format(new Date(card.purchasedAt || ''), "MMM d, yyyy")}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Digital Punch Cards */}
              <div>
                <div className="flex items-center mb-4">
                  <Ticket className="h-6 w-6 text-amber-600 mr-2" />
                  <h3 className="text-lg font-bold">Digital Day Pass Packages</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Perfect for occasional visits or trying out our thermal wellness center. Buy a package of day passes and save money on individual visits.
                </p>
                {isPunchCardOptionsLoading ? (
                  <div className="p-6 text-center">Loading punch card options...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {punchCardOptions?.map((option, index) => {
                      const savings = (option.totalPunches * 3000) - option.totalPrice; // Assuming $30 regular day pass price
                      const savingsPercentage = Math.round((savings / (option.totalPunches * 3000)) * 100);
                      
                      return (
                        <Card key={index} className="overflow-hidden border-2 border-amber-200 hover:border-amber-300 transition-colors">
                          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 relative">
                            {index === 1 && (
                              <Badge className="absolute top-2 right-2 bg-white text-amber-600">
                                <Star className="h-3 w-3 mr-1" />
                                Popular
                              </Badge>
                            )}
                            <div className="flex items-center justify-between">
                              <Ticket className="h-6 w-6" />
                              <div className="text-right">
                                <div className="text-sm opacity-90">Save {savingsPercentage}%</div>
                              </div>
                            </div>
                            <CardTitle className="text-xl font-bold mt-2">{option.name}</CardTitle>
                            <div className="text-2xl font-bold mt-1">
                              {formatPrice(option.totalPrice)}
                              <div className="text-sm font-normal opacity-90 mt-1">
                                {formatPrice(option.pricePerPunch)} per visit
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <ul className="space-y-2">
                              <li className="flex items-center">
                                <Check className="text-green-500 mr-2 h-4 w-4" />
                                <span className="text-sm">{option.totalPunches} thermal wellness visits</span>
                              </li>
                              <li className="flex items-center">
                                <Check className="text-green-500 mr-2 h-4 w-4" />
                                <span className="text-sm">Access to all thermal facilities</span>
                              </li>
                              <li className="flex items-center">
                                <Check className="text-green-500 mr-2 h-4 w-4" />
                                <span className="text-sm">No expiration date</span>
                              </li>
                              <li className="flex items-center">
                                <Check className="text-green-500 mr-2 h-4 w-4" />
                                <span className="text-sm">Save {formatPrice(savings)} total</span>
                              </li>
                            </ul>
                          </CardContent>
                          <CardFooter className="p-4 pt-0">
                            <Button 
                              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                              onClick={() => {
                                purchasePunchCardMutation.mutate({
                                  name: option.name,
                                  totalPunches: option.totalPunches,
                                  remainingPunches: option.totalPunches,
                                  pricePerPunch: option.pricePerPunch,
                                  totalPrice: option.totalPrice,
                                  status: 'active'
                                });
                              }}
                              disabled={purchasePunchCardMutation.isPending}
                            >
                              {purchasePunchCardMutation.isPending ? 'Processing...' : 'Purchase Package'}
                            </Button>
                          </CardFooter>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}