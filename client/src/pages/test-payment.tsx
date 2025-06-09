import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ amount, description }: { amount: number, description: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/test-payment`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setIsComplete(true);
      toast({
        title: "Payment Successful",
        description: "Thank you for your payment!",
      });
    }

    setIsLoading(false);
  };

  if (isComplete) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">Your payment of ${amount} has been processed.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full wellness-button-primary"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay ${amount}
          </>
        )}
      </Button>
    </form>
  );
};

export default function TestPayment() {
  const [clientSecret, setClientSecret] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<{
    name: string;
    amount: number;
    description: string;
  } | null>(null);

  const packages = [
    {
      name: "Day Pass",
      amount: 25,
      description: "Single day access to all thermal facilities"
    },
    {
      name: "Weekly Pass",
      amount: 150,
      description: "7-day access to all thermal facilities"
    },
    {
      name: "Monthly Membership",
      amount: 299,
      description: "30-day unlimited access plus guest privileges"
    }
  ];

  const createPaymentIntent = async (amount: number, description: string) => {
    try {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        amount,
        description: `Wolf Mother Wellness - ${description}`
      });
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error("Error creating payment intent:", error);
    }
  };

  const selectPackage = (pkg: typeof packages[0]) => {
    setSelectedPackage(pkg);
    createPaymentIntent(pkg.amount, pkg.description);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="wellness-container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Test Payment System
            </h1>
            <p className="text-muted-foreground">
              Wolf Mother Wellness - Secure Payment Processing
            </p>
          </div>

          {!selectedPackage ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                Choose a Package to Test
              </h2>
              
              <div className="wellness-grid">
                {packages.map((pkg) => (
                  <Card key={pkg.name} className="wellness-card cursor-pointer hover:shadow-lg transition-shadow" onClick={() => selectPackage(pkg)}>
                    <CardHeader className="text-center">
                      <CardTitle className="text-xl font-display text-foreground">
                        {pkg.name}
                      </CardTitle>
                      <div className="text-3xl font-bold text-primary">
                        ${pkg.amount}
                      </div>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-muted-foreground mb-4">
                        {pkg.description}
                      </p>
                      <Button className="w-full wellness-button-primary">
                        Select Package
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="wellness-card bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-primary mb-2">Test Card Numbers</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success:</span>
                      <code className="bg-background px-2 py-1 rounded">4242 4242 4242 4242</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Decline:</span>
                      <code className="bg-background px-2 py-1 rounded">4000 0000 0000 0002</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Require 3DS:</span>
                      <code className="bg-background px-2 py-1 rounded">4000 0025 0000 3155</code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Use any future expiry date, any 3-digit CVC, and any postal code.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="wellness-card">
                <CardHeader className="text-center">
                  <Badge variant="outline" className="mx-auto mb-2">
                    Selected Package
                  </Badge>
                  <CardTitle className="text-2xl font-display text-foreground">
                    {selectedPackage.name}
                  </CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    ${selectedPackage.amount}
                  </div>
                  <p className="text-muted-foreground">
                    {selectedPackage.description}
                  </p>
                </CardHeader>
              </Card>

              <Card className="wellness-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2 text-primary" />
                    Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutForm amount={selectedPackage.amount} description={selectedPackage.description} />
                    </Elements>
                  ) : (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-muted-foreground">Setting up payment...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedPackage(null);
                    setClientSecret("");
                  }}
                  className="border-border hover:bg-muted"
                >
                  ← Choose Different Package
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}