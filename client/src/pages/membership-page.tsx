import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Membership, MembershipPlan } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Edit, Calendar, CreditCard, AlertTriangle } from "lucide-react";
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
                    <p className="text-gray-600 mb-4">You don't have an active thermal wellness membership yet.</p>
                    <Button className="bg-primary hover:bg-primary/90">Start Your Thermal Wellness Journey</Button>
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
              <div>
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
                                : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-900'}`}
                              disabled={isCurrentPlan}
                            >
                              {isCurrentPlan ? 'Current Plan' : plan.monthlyPrice < (currentPlan?.monthlyPrice || 0) ? 'Downgrade' : 'Upgrade'}
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
