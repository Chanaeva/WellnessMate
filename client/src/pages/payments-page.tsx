import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Payment, Membership, PaymentMethod, MembershipPlan, PunchCard } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, CreditCard, Shield, Lock, Plus, Loader2, Crown, Star, Zap, Check, Ticket, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AddPaymentMethod } from "@/components/payment/add-payment-method";
import { PaymentMethodCard } from "@/components/payment/payment-method-card";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

export default function PaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState("3months");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [isUpdatingPaymentMethod, setIsUpdatingPaymentMethod] = useState(false);
  const itemsPerPage = 5;

  // Fetch membership data
  const { data: membership } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch payments data
  const { data: payments, isLoading: isPaymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: !!user,
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading: isPaymentMethodsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans, isLoading: isPlansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Fetch day pass options
  const { data: dayPassOptions, isLoading: isDayPassOptionsLoading } = useQuery<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]>({
    queryKey: ["/api/punch-cards/options"],
  });

  // Fetch user's day pass packages
  const { data: userDayPasses, isLoading: isUserDayPassesLoading } = useQuery<PunchCard[]>({
    queryKey: ["/api/punch-cards"],
    enabled: !!user,
  });

  // Purchase membership mutation
  const purchaseMembershipMutation = useMutation({
    mutationFn: async (plan: MembershipPlan) => {
      console.log('Starting membership purchase for:', plan);
      
      // Create payment intent
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: plan.monthlyPrice / 100, // Convert cents to dollars
        description: `Wolf Mother Wellness - ${plan.name}`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();
      console.log('Payment intent created:', paymentIntentId);

      // Confirm payment and create membership
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${plan.name}`
      });
      
      if (!confirmRes.ok) {
        throw new Error('Payment confirmation failed');
      }

      return await confirmRes.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Membership Purchased!",
        description: "Your membership has been activated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error: any) => {
      console.error('Membership purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase membership",
        variant: "destructive",
      });
    },
  });

  // Purchase day pass mutation
  const purchaseDayPassMutation = useMutation({
    mutationFn: async (dayPassData: any) => {
      // Create payment intent
      const paymentIntentRes = await apiRequest("POST", "/api/create-payment-intent", {
        amount: dayPassData.totalPrice / 100,
        description: `Wolf Mother Wellness - ${dayPassData.name}`
      });
      const { clientSecret, paymentIntentId } = await paymentIntentRes.json();

      // Confirm payment and create day pass package
      const confirmRes = await apiRequest("POST", "/api/confirm-payment", {
        paymentIntentId,
        membershipId: null,
        description: `Wolf Mother Wellness - ${dayPassData.name}`
      });
      
      if (!confirmRes.ok) {
        throw new Error('Payment confirmation failed');
      }

      // Create day pass package
      const dayPassRes = await apiRequest("POST", "/api/punch-cards", {
        name: dayPassData.name,
        totalPunches: dayPassData.totalPunches,
        remainingPunches: dayPassData.totalPunches,
        pricePerPunch: dayPassData.pricePerPunch,
        totalPrice: dayPassData.totalPrice,
      });

      return await dayPassRes.json();
    },
    onSuccess: () => {
      toast({
        title: "Day Pass Package Purchased!",
        description: "Your day pass package has been added to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase day pass package",
        variant: "destructive",
      });
    },
  });

  // Helper function to convert cents to dollars
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Filter payments based on time filter
  const getFilteredPayments = () => {
    if (!payments) return [];
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (timeFilter) {
      case "3months":
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        filterDate.setMonth(now.getMonth() - 6);
        break;
      case "year":
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      case "all":
        return payments;
      default:
        filterDate.setMonth(now.getMonth() - 3);
    }
    
    return payments.filter(payment => {
      if (!payment.transactionDate) return false;
      return new Date(payment.transactionDate) >= filterDate;
    });
  };
  
  const filteredPayments = getFilteredPayments();
  
  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const currentPageData = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader className="bg-primary text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">Payment History</CardTitle>
                  <CardDescription className="text-white/80">View and manage your billing information</CardDescription>
                </div>
                <div className="flex items-center space-x-2 text-white/90">
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">Secure Payments</span>
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Billing Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Current Plan</h4>
                    <p className="font-medium">{membership?.planType === 'daily' ? 'Drop-in Pass' : 'Monthly Membership'}</p>
                    <p className="text-sm text-gray-500 mt-2">{membership ? formatPrice(membership.planType === 'daily' ? 3000 : 6500) : '$0.00'}{membership?.planType === 'daily' ? '/day' : '/month'}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Next Billing Date</h4>
                    <p className="font-medium">{membership ? format(new Date(membership.endDate), "MMMM d, yyyy") : 'N/A'}</p>
                    <p className="text-sm text-gray-500 mt-2">{membership?.autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled'}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm text-gray-500 mb-1">Payment Method</h4>
                    {paymentMethods && paymentMethods.length > 0 ? (
                      <p className="font-medium">
                        {paymentMethods.find(pm => pm.isDefault)?.cardBrand || paymentMethods[0]?.cardBrand || 'Card'} ending in {paymentMethods.find(pm => pm.isDefault)?.cardLast4 || paymentMethods[0]?.cardLast4 || '****'}
                      </p>
                    ) : (
                      <p className="font-medium text-gray-500">No payment method</p>
                    )}
                    <div className="mt-2 flex">
                      <Button 
                        variant="link" 
                        className="text-primary p-0 h-auto mr-3"
                        onClick={() => {
                          setIsUpdatingPaymentMethod(true);
                          setShowAddPaymentMethod(true);
                        }}
                      >
                        {paymentMethods && paymentMethods.length > 0 ? 'Update' : 'Add Payment Method'}
                      </Button>
                      <Button 
                        variant="link" 
                        className="text-primary p-0 h-auto"
                        onClick={() => {
                          setIsUpdatingPaymentMethod(false);
                          setShowAddPaymentMethod(true);
                        }}
                      >
                        Add New
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction History */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Transaction History</h3>
                  <div className="flex items-center">
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger className="w-[180px] mr-2 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3months">Last 3 Months</SelectItem>
                        <SelectItem value="6months">Last 6 Months</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="flex items-center h-9">
                      <Download className="h-4 w-4 mr-1" /> Export
                    </Button>
                  </div>
                </div>

                {isPaymentsLoading ? (
                  <div className="p-6 text-center">Loading payment history...</div>
                ) : filteredPayments.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentPageData.map((payment, index) => (
                            <tr key={payment.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.transactionDate ? format(payment.transactionDate, "MMM d, yyyy") : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatPrice(payment.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge className={
                                  payment.status === 'successful' ? 'bg-green-100 text-green-800' : 
                                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                  payment.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <Button variant="link" className="text-primary p-0 h-auto">Download</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} transactions
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="icon"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                          >
                            <span className="sr-only">Previous page</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
                              <path d="m15 18-6-6 6-6" />
                            </svg>
                          </Button>
                          <div className="flex items-center">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                className="mx-1 h-8 w-8 p-0"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            ))}
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                          >
                            <span className="sr-only">Next page</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center bg-gray-50 rounded-lg">
                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No payment history</h3>
                    <p className="mt-1 text-sm text-gray-500">Your payment history will appear here once you make a payment</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods Section */}
          <Card className="bg-white shadow-sm">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Manage your saved credit cards for secure payments
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setIsUpdatingPaymentMethod(false);
                    setShowAddPaymentMethod(true);
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Security Notice */}
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-emerald-800">Secure Payment Processing</h4>
                    <p className="text-sm text-emerald-700 mt-1">
                      Your payment information is encrypted and stored securely with Stripe. 
                      <Lock className="h-3 w-3 inline mx-1" />
                      We never store your full card details on our servers.
                    </p>
                  </div>
                </div>
              </div>

              {showAddPaymentMethod ? (
                <Elements stripe={stripePromise}>
                  <AddPaymentMethod
                    isUpdating={isUpdatingPaymentMethod}
                    onSuccess={() => {
                      setShowAddPaymentMethod(false);
                      setIsUpdatingPaymentMethod(false);
                    }}
                    onCancel={() => {
                      setShowAddPaymentMethod(false);
                      setIsUpdatingPaymentMethod(false);
                    }}
                  />
                </Elements>
              ) : (
                <div className="space-y-4">
                  {isPaymentMethodsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-600">Loading payment methods...</span>
                    </div>
                  ) : paymentMethods && paymentMethods.length > 0 ? (
                    <div className="grid gap-4">
                      {paymentMethods.map((method) => (
                        <PaymentMethodCard
                          key={method.id}
                          paymentMethod={method}
                          showActions={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Methods</h3>
                      <p className="text-gray-600 mb-4">
                        Add a credit card to make payments for memberships and day passes.
                      </p>
                      <Button
                        onClick={() => setShowAddPaymentMethod(true)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Card
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
