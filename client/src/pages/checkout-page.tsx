import { useState, useEffect } from "react";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PaymentMethod } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingCart, CreditCard, Shield, ArrowLeft, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AddPaymentMethod } from "@/components/payment/add-payment-method";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, getTotalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPaymentMethodAlert, setShowPaymentMethodAlert] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    enabled: !!user,
  });

  const hasPaymentMethod = paymentMethods && paymentMethods.length > 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  // Process checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const cartData = {
        items: items.map(item => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity || 1,
          data: item.data
        })),
        totalAmount: getTotalPrice()
      };

      const res = await apiRequest("POST", "/api/checkout", cartData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Successful!",
        description: "Your purchase has been processed successfully.",
      });
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "There was an error processing your order.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (!hasPaymentMethod) {
      setShowPaymentMethodAlert(true);
      return;
    }
    checkoutMutation.mutate();
  };

  const handleAddPaymentMethod = () => {
    setShowPaymentMethodAlert(false);
    setShowAddPaymentMethod(true);
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      setLocation("/packages");
    }
  }, [items, setLocation]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Redirecting to packages...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow wellness-container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/packages">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Packages
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-heading text-foreground">Checkout</h1>
              <p className="text-muted-foreground">Review and complete your order</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Summary */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            {item.type === 'membership' ? 'Monthly Plan' : 'Day Passes'}
                          </Badge>
                          {item.type === 'punch_card' && item.quantity && item.quantity > 1 && (
                            <Badge variant="outline">
                              Qty: {item.quantity}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatPrice(item.price * (item.quantity || 1))}
                        </div>
                        {item.type === 'membership' && (
                          <div className="text-sm text-muted-foreground">/month</div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasPaymentMethod ? (
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {paymentMethods?.[0]?.cardBrand?.toUpperCase()} •••• {paymentMethods?.[0]?.cardLast4}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Expires {paymentMethods?.[0]?.cardExpMonth}/{paymentMethods?.[0]?.cardExpYear}
                        </div>
                      </div>
                      <Check className="h-5 w-5 text-success" />
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No payment method on file</p>
                      <Button 
                        variant="outline"
                        onClick={() => setShowAddPaymentMethod(true)}
                      >
                        Add Payment Method
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>

            {/* Order Total & Checkout */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Total</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.name}
                          {item.type === 'punch_card' && item.quantity && item.quantity > 1 && ` (${item.quantity})`}
                        </span>
                        <span>{formatPrice(item.price * (item.quantity || 1))}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(getTotalPrice())}</span>
                  </div>

                  <Button 
                    className="w-full wellness-button-primary" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={checkoutMutation.isPending || !hasPaymentMethod}
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Complete Order
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Secure checkout powered by Stripe
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Security Notice */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary">Secure Checkout</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your payment information is encrypted and secure. We never store your card details.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Payment Method Form */}
              {showAddPaymentMethod && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Elements stripe={stripePromise}>
                      <AddPaymentMethod
                        onSuccess={() => {
                          setShowAddPaymentMethod(false);
                          queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
                          toast({
                            title: "Payment Method Added",
                            description: "You can now complete your purchase.",
                          });
                        }}
                        onCancel={() => setShowAddPaymentMethod(false)}
                      />
                    </Elements>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Payment Method Required Alert */}
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
              You need to add a payment method before completing your order. This helps us process your purchase securely.
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