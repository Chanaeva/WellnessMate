import { useState } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, Loader2 } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const elementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1.5',
      '::placeholder': {
        color: '#6b7280',
      },
      iconColor: '#374151',
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

interface StaffItemPaymentFormProps {
  checkoutId: number;
  itemName: string;
  priceInCents: number;
  memberName: string;
  memberEmail?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentFormContent({ checkoutId, itemName, priceInCents, memberName, memberEmail, onSuccess, onCancel }: StaffItemPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/staff/checkouts/${checkoutId}/create-payment-intent`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create payment");
      }
      return await res.json();
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const res = await apiRequest("POST", `/api/staff/checkouts/${checkoutId}/confirm-payment`, {
        paymentIntentId
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to confirm payment");
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
      const { clientSecret } = await createPaymentIntentMutation.mutateAsync();
      
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error("Card element not found");
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: memberName,
            email: memberEmail,
          },
        }
      });

      if (error) {
        setCardError(error.message || "Payment failed");
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        await confirmPaymentMutation.mutateAsync(paymentIntent.id);
        
        toast({
          title: "Payment Successful",
          description: `$${(priceInCents / 100).toFixed(2)} has been charged`,
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
        onSuccess();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
        <div className="text-sm text-slate-600 dark:text-slate-400">Charging</div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          ${(priceInCents / 100).toFixed(2)}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          for {itemName} to {memberName}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Card Number</label>
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expiry</label>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <CardExpiryElement
                options={elementOptions}
                onChange={(e) => {
                  if (e.error) setCardError(e.error.message);
                  else if (e.complete) setCardError(null);
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CVC</label>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <CardCvcElement
                options={elementOptions}
                onChange={(e) => {
                  if (e.error) setCardError(e.error.message);
                  else if (e.complete) setCardError(null);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {cardError && (
        <div className="text-sm text-red-600 dark:text-red-400">{cardError}</div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isProcessing}
          data-testid="button-cancel-payment"
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={!stripe || isProcessing}
          data-testid="button-process-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Charge ${(priceInCents / 100).toFixed(2)}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface StaffItemPaymentDialogProps {
  open: boolean;
  checkoutId: number;
  itemName: string;
  priceInCents: number;
  memberName: string;
  memberEmail?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function StaffItemPaymentDialog({ 
  open, 
  checkoutId, 
  itemName, 
  priceInCents, 
  memberName, 
  memberEmail,
  onSuccess, 
  onClose 
}: StaffItemPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-payment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Enter the member's card details to process payment
          </DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise}>
          <PaymentFormContent
            checkoutId={checkoutId}
            itemName={itemName}
            priceInCents={priceInCents}
            memberName={memberName}
            memberEmail={memberEmail}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}
