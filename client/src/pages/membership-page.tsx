import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Membership, MembershipPlan, PunchCard } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Edit, Calendar, CreditCard, AlertTriangle, Ticket, Star } from "lucide-react";
import { format } from "date-fns";

export default function MembershipPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch membership data
  const { data: membership, isLoading: isMembershipLoading } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans, isLoading: isPlansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Fetch punch card options
  const { data: punchCardOptions, isLoading: isPunchCardOptionsLoading } = useQuery<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]>({
    queryKey: ["/api/punch-cards/options"],
  });

  // Fetch user's punch cards
  const { data: userPunchCards, isLoading: isUserPunchCardsLoading } = useQuery<PunchCard[]>({
    queryKey: ["/api/punch-cards"],
    enabled: !!user,
  });

  // Purchase punch card through Stripe payment
  const purchasePunchCardMutation = useMutation({
    mutationFn: async (punchCardData: any) => {
      // First create a payment intent
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
      // First create a payment intent
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: planData.monthlyPrice / 100, // Convert cents to dollars
        description: `Wolf Mother Wellness - ${planData.name} Membership`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // For demo purposes, simulate successful payment
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: planData.id,
        description: `Membership Purchase - ${planData.name}`
      });
      
      if (confirmRes.ok) {
        // Update membership after successful payment
        const membershipRes = await apiRequest("PATCH", "/api/membership", {
          planType: planData.planType,
          status: 'active'
        });
        return await membershipRes.json();
      } else {
        throw new Error("Payment processing failed");
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
              {/* Current Plan */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4">Current Plan</h3>
                {isMembershipLoading ? (
                  <div className="p-6 text-center">Loading membership details...</div>
                ) : membership ? (
                  <>
                    <div className="bg-neutral-light rounded-lg p-4 border border-gray-200">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                          <Badge className={`mb-2 ${membership.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                            {membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
                          </Badge>
                          <h4 className="text-xl font-medium">
                            {currentPlan?.name || 'Basic Membership'}
                          </h4>
                          <p className="text-gray-600 mt-1">
                            {currentPlan?.description || 'Access to basic facilities'}
                          </p>
                        </div>
                        <div className="mt-4 md:mt-0">
                          <div className="text-2xl font-bold">
                            {currentPlan ? formatPrice(currentPlan.monthlyPrice) : '$0.00'}
                            <span className="text-sm font-normal text-gray-500">/month</span>
                          </div>
                          <p className="text-sm text-gray-500">
                            Next billing: {format(new Date(membership.endDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <div className="flex flex-wrap gap-2">
                          {currentPlan?.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="bg-primary/10 text-primary px-3 py-1 flex items-center">
                              <Check className="mr-1 h-3 w-3" /> {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3 flex-wrap">
                      <Button variant="outline" className="flex items-center">
                        <Edit className="mr-2 h-4 w-4" /> Change Plan
                      </Button>
                      <Button variant="outline" className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" /> Freeze Membership
                      </Button>
                      <Button variant="outline" className="text-red-500 border-red-300 hover:bg-red-50 flex items-center">
                        <AlertTriangle className="mr-2 h-4 w-4" /> Cancel Membership
                      </Button>
                    </div>
                  </>
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

              {/* Available Plans */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4">Available Plans</h3>
                {isPlansLoading ? (
                  <div className="p-6 text-center">Loading available plans...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {membershipPlans?.filter(plan => plan.planType !== 'daily').map((plan) => {
                      const isCurrentPlan = membership?.planType === plan.planType;
                      
                      return (
                        <Card key={plan.id} className={`overflow-hidden ${isCurrentPlan ? 'border-2 border-primary' : ''}`}>
                          <CardHeader className={`p-4 ${isCurrentPlan ? 'bg-primary/10' : 'bg-gray-50'} border-b ${isCurrentPlan ? 'border-primary/20' : 'border-gray-200'}`}>
                            {isCurrentPlan && (
                              <Badge className="absolute top-2 right-2 bg-primary">
                                Current
                              </Badge>
                            )}
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
                              className={`w-full ${isCurrentPlan 
                                ? 'bg-primary text-white opacity-50 cursor-not-allowed' 
                                : 'wellness-button-primary'}`}
                              disabled={isCurrentPlan || purchaseMembershipMutation.isPending}
                              onClick={() => {
                                if (!isCurrentPlan) {
                                  purchaseMembershipMutation.mutate(plan);
                                }
                              }}
                            >
                              {isCurrentPlan 
                                ? 'Current Plan' 
                                : purchaseMembershipMutation.isPending 
                                  ? 'Processing...' 
                                  : plan.monthlyPrice < (currentPlan?.monthlyPrice || 0) 
                                    ? 'Downgrade' 
                                    : 'Purchase Package'
                              }
                            </Button>
                          </CardFooter>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>

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
