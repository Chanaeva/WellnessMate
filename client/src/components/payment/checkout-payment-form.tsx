import { useState, useEffect } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement } from "@stripe/react-stripe-js";
import { PaymentRequest } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, Loader2, Shield, Smartphone } from "lucide-react";

const elementOptions = {
  style: {
    base: {
      fontSize: '18px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1.5',
      '::placeholder': {
        color: '#6b7280',
      },
      iconColor: '#374151',
      padding: '16px 0',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
    complete: {
      color: '#059669',
      iconColor: '#059669',
    },
  },
};

interface CheckoutPaymentFormProps {
  items: Array<{
    id: string;
    type: string;
    quantity?: number;
    data: any;
  }>;
  promoCode?: { code: string } | null;
  onSuccess: (paymentIntentId: string) => void;
  onCancel?: () => void;
  billingDetails?: {
    name?: string;
    email?: string;
  };
}

export function CheckoutPaymentForm({ items, promoCode, onSuccess, onCancel, billingDetails }: CheckoutPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  // Calculate total for Apple Pay/Google Pay button
  const totalAmount = items.reduce((sum, item) => {
    const price = item.data?.price || 0;
    return sum + (price * (item.quantity || 1));
  }, 0);

  // Initialize Apple Pay / Google Pay
  useEffect(() => {
    if (!stripe || totalAmount <= 0) return;

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: 'Wolf Mother Wellness',
        amount: totalAmount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if the browser supports Apple Pay or Google Pay
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      } else {
        setPaymentRequest(null);
        setCanMakePayment(false);
      }
    });

    // Handle the payment when user approves
    const handlePaymentMethod = async (ev: any) => {
      setIsProcessing(true);
      let paymentCompleted = false;
      try {
        // Create payment intent on server
        const res = await apiRequest("POST", "/api/stripe/create-payment-intent", {
          items: items.map(item => ({
            type: item.type,
            quantity: item.quantity || 1,
            data: item.data
          })),
          promoCode: promoCode || undefined
        });
        
        if (!res.ok) {
          const error = await res.json();
          ev.complete('fail');
          paymentCompleted = true;
          throw new Error(error.message || "Failed to create payment");
        }
        
        const { clientSecret, paymentIntentId, subscriptionId, type, invoiceId } = await res.json();

        // Confirm the payment with the payment method from Apple Pay/Google Pay
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete('fail');
          paymentCompleted = true;
          throw new Error(confirmError.message);
        }

        // Mark as success before handling additional actions
        ev.complete('success');
        paymentCompleted = true;

        if (paymentIntent?.status === 'requires_action') {
          // Handle additional authentication if needed (SCA)
          try {
            const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
            if (actionError) {
              throw new Error(actionError.message);
            }
          } catch (scaError: any) {
            throw new Error(scaError.message || "Authentication failed");
          }
        }

        // Finalize the order
        const finalizeRes = await apiRequest("POST", "/api/stripe/finalize-order", {
          paymentIntentId,
          subscriptionId,
          type,
          invoiceId,
          items: items.map(item => ({
            type: item.type,
            quantity: item.quantity || 1,
            data: item.data
          })),
          promoCode: promoCode || undefined
        });

        if (!finalizeRes.ok) {
          const error = await finalizeRes.json();
          throw new Error(error.message || "Failed to finalize order");
        }

        queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
        queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
        onSuccess(paymentIntentId);
      } catch (error: any) {
        // Make sure we complete the payment request if not already done
        if (!paymentCompleted) {
          ev.complete('fail');
        }
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    pr.on('paymentmethod', handlePaymentMethod);

    // Cleanup: remove listener when dependencies change
    return () => {
      pr.off('paymentmethod', handlePaymentMethod);
    };
  }, [stripe, totalAmount, items, promoCode, onSuccess, toast]);

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/create-payment-intent", {
        items: items.map(item => ({
          type: item.type,
          quantity: item.quantity || 1,
          data: item.data
        })),
        promoCode: promoCode || undefined
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create payment");
      }
      return await res.json();
    },
  });

  const finalizeOrderMutation = useMutation({
    mutationFn: async (data: { 
      paymentIntentId: string; 
      subscriptionId?: string; 
      type?: string;
      invoiceId?: string;
    }) => {
      const res = await apiRequest("POST", "/api/stripe/finalize-order", {
        paymentIntentId: data.paymentIntentId,
        subscriptionId: data.subscriptionId,
        type: data.type,
        invoiceId: data.invoiceId,
        items: items.map(item => ({
          type: item.type,
          quantity: item.quantity || 1,
          data: item.data
        })),
        promoCode: promoCode || undefined
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to finalize order");
      }
      return await res.json();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      const checkoutData = await createPaymentIntentMutation.mutateAsync();
      const { 
        clientSecret, 
        paymentIntentId, 
        subscriptionId, 
        type, 
        invoiceId,
        alreadyPaid,
        requiresPaymentMethod,
        subscriptionStatus,
      } = checkoutData;
      
      // Case 1: Payment was already completed with saved card
      if (alreadyPaid && subscriptionStatus === 'active') {
        console.log('Subscription already paid with saved card, finalizing...');
        await finalizeOrderMutation.mutateAsync({
          paymentIntentId: 'saved_card_payment',
          subscriptionId,
          type: 'subscription',
          invoiceId,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
        queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
        onSuccess(subscriptionId || 'saved_card_payment');
        return;
      }
      
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error("Card number element not found");
      }

      // Case 2: SetupIntent flow - need to collect card first, then complete subscription
      if (type === 'subscription_setup' || requiresPaymentMethod) {
        console.log('Using SetupIntent to collect card...');
        
        const { error: setupError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: cardNumberElement,
            billing_details: billingDetails ? {
              name: billingDetails.name,
              email: billingDetails.email,
            } : undefined,
          }
        });

        if (setupError) {
          setCardError(setupError.message || "Card setup failed");
          throw new Error(setupError.message);
        }

        if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
          console.log('Card setup succeeded, completing subscription...');
          
          // Now complete the subscription with the saved payment method
          await finalizeOrderMutation.mutateAsync({
            paymentIntentId: setupIntent.payment_method as string,
            subscriptionId,
            type: 'subscription_setup_complete',
            invoiceId,
          });
          
          queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
          queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
          onSuccess(subscriptionId || setupIntent.id);
          return;
        } else {
          throw new Error(`Card setup was not completed. Status: ${setupIntent?.status}`);
        }
      }

      // Case 3: Normal PaymentIntent flow
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: billingDetails ? {
            name: billingDetails.name,
            email: billingDetails.email,
          } : undefined,
        }
      });

      if (error) {
        setCardError(error.message || "Payment failed");
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        // Finalize the order (create membership/punch cards, save payment method)
        try {
          await finalizeOrderMutation.mutateAsync({
            paymentIntentId,
            subscriptionId,
            type,
            invoiceId,
          });
        } catch (finalizeError: any) {
          console.error('Finalize order failed:', finalizeError);
          toast({
            title: "Payment Received",
            description: "Your payment was processed but there was an issue activating your membership. Please contact support.",
            variant: "destructive",
          });
          throw finalizeError;
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
        queryClient.invalidateQueries({ queryKey: ["/api/membership"] });
        onSuccess(paymentIntentId);
      } else {
        throw new Error(`Payment was not completed. Status: ${paymentIntent?.status}`);
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-lg">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl text-gray-900 flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Enter Payment Details
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Your card will be charged and saved for future purchases
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {/* Apple Pay / Google Pay Button */}
        {canMakePayment && paymentRequest && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
              <Smartphone className="h-5 w-5 text-primary" />
              Express Checkout
            </div>
            {isProcessing ? (
              <div className="flex items-center justify-center py-4 bg-gray-100 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
                <span className="text-gray-700">Processing payment...</span>
              </div>
            ) : (
              <PaymentRequestButtonElement
                options={{
                  paymentRequest,
                  style: {
                    paymentRequestButton: {
                      type: 'default',
                      theme: 'dark',
                      height: '48px',
                    },
                  },
                }}
              />
            )}
            <div className="flex items-center gap-4 my-6">
              <Separator className="flex-1" />
              <span className="text-sm text-muted-foreground">or pay with card</span>
              <Separator className="flex-1" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900 block">Card Number</label>
              <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <CardNumberElement 
                  options={elementOptions} 
                  onChange={(e) => {
                    if (e.error) {
                      setCardError(e.error.message);
                    } else {
                      setCardError(null);
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-base font-medium text-gray-900 block">Expiry Date</label>
                <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <CardExpiryElement options={elementOptions} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-gray-900 block">CVC</label>
                <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <CardCvcElement options={elementOptions} />
                </div>
              </div>
            </div>

            {cardError && (
              <p className="text-sm text-red-600 mt-2">{cardError}</p>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <Shield className="h-4 w-4" />
              <span>Your card information is securely processed by Stripe</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
              disabled={!stripe || isProcessing}
              size="lg"
              data-testid="button-pay-now"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-5 w-5" />
                  Pay Now
                </>
              )}
            </Button>
            
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
                className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 py-3 text-base font-medium"
                size="lg"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
