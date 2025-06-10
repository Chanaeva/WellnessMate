import { useState } from "react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Loader2 } from "lucide-react";

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#fff',
      '::placeholder': {
        color: '#aab7c4',
      },
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
      
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      // Confirm setup intent
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
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
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          {isUpdating ? "Update Payment Method" : "Add New Payment Method"}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {isUpdating ? "Replace your current payment method" : "Add a credit or debit card for secure payments"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Card Details</label>
            <div className="p-3 bg-slate-700/50 border border-slate-600 rounded-md">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
              disabled={!stripe || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
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