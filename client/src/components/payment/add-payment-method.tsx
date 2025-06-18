import { useState } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Loader2 } from "lucide-react";

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

interface AddPaymentMethodProps {
  isUpdating?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddPaymentMethod({ isUpdating = false, onSuccess, onCancel }: AddPaymentMethodProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const setupIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/setup-intent");
      return await res.json();
    },
  });

  const savePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await apiRequest("POST", "/api/payment-methods", { paymentMethodId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Payment Method Added",
        description: "Your credit card has been successfully added.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Save Card",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Get setup intent
      const { clientSecret } = await setupIntentMutation.mutateAsync();
      
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error("Card number element not found");
      }

      // Confirm setup intent
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (setupIntent?.payment_method) {
        // Save payment method to database
        await savePaymentMethodMutation.mutateAsync(setupIntent.payment_method as string);
      }
    } catch (error: any) {
      toast({
        title: "Failed to Add Card",
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
          {isUpdating ? "Update Payment Method" : "Add New Payment Method"}
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          {isUpdating ? "Replace your current payment method" : "Add a credit or debit card for secure payments"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-base font-medium text-gray-900 block">Card Number</label>
              <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <CardNumberElement options={elementOptions} />
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

            <p className="text-sm text-gray-500 mt-2">
              Your card information is securely processed by Stripe and never stored on our servers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white py-3 text-base font-medium"
              disabled={!stripe || isProcessing}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isUpdating ? "Updating..." : "Adding Card..."}
                </>
              ) : (
                isUpdating ? "Update Payment Method" : "Add Payment Method"
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