import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Loader2 } from "lucide-react";

const stripePromise = fetch("/api/stripe/config")
  .then((res) => res.json())
  .then(({ publicKey }) => loadStripe(publicKey));

const elementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1.5',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
    },
    complete: {
      color: '#059669',
    },
  },
};

interface AdminAddPaymentMethodFormProps {
  clientSecret: string;
  memberId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function AdminAddPaymentMethodForm({ clientSecret, memberId, onSuccess, onCancel }: AdminAddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error("Card element not found");
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (setupIntent?.payment_method) {
        const res = await apiRequest("POST", `/api/admin/members/${memberId}/save-payment-method`, {
          paymentMethodId: setupIntent.payment_method,
          setAsDefault: true
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to save payment method");
        }
        
        toast({
          title: "Payment Method Added",
          description: "The card has been successfully added to the member's account.",
        });
        onSuccess();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 block">Card Number</label>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
            <CardNumberElement options={elementOptions} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">Expiry Date</label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
              <CardExpiryElement options={elementOptions} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">CVC</label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
              <CardCvcElement options={elementOptions} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Add Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface AdminAddPaymentMethodProps {
  clientSecret: string;
  memberId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminAddPaymentMethod({ clientSecret, memberId, onSuccess, onCancel }: AdminAddPaymentMethodProps) {
  return (
    <Elements stripe={stripePromise}>
      <AdminAddPaymentMethodForm 
        clientSecret={clientSecret}
        memberId={memberId}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
