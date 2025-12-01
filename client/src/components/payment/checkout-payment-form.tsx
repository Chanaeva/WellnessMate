import { useState } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, Loader2, Shield } from "lucide-react";

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
}

export function CheckoutPaymentForm({ items, promoCode, onSuccess, onCancel }: CheckoutPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

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
    mutationFn: async (paymentIntentId: string) => {
      const res = await apiRequest("POST", "/api/stripe/finalize-order", {
        paymentIntentId,
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
      const { clientSecret, paymentIntentId } = await createPaymentIntentMutation.mutateAsync();
      
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error("Card number element not found");
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        }
      });

      if (error) {
        setCardError(error.message || "Payment failed");
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        // Finalize the order (create membership/punch cards, save payment method)
        await finalizeOrderMutation.mutateAsync(paymentIntentId);
        
        queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
        onSuccess(paymentIntentId);
      } else {
        throw new Error("Payment was not completed");
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
