import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Trash2, Star, StarOff, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface PaymentMethod {
  id: number;
  stripePaymentMethodId: string;
  cardLast4: string;
  cardBrand: string;
  cardExpMonth: number;
  cardExpYear: number;
  isDefault: boolean;
}

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onSelect?: (paymentMethod: PaymentMethod) => void;
  isSelected?: boolean;
  showActions?: boolean;
}

export function PaymentMethodCard({ 
  paymentMethod, 
  onSelect, 
  isSelected = false,
  showActions = true 
}: PaymentMethodCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/payment-methods/${paymentMethod.stripePaymentMethodId}/default`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Default Payment Method Updated",
        description: "This card is now your default payment method.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Default",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/payment-methods/${paymentMethod.stripePaymentMethodId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Payment Method Removed",
        description: "Your credit card has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Card",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    try {
      await setDefaultMutation.mutateAsync();
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync();
    } finally {
      setIsDeleting(false);
    }
  };

  const getCardIcon = (brand: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <Card 
      className={`bg-slate-800/50 border-slate-700 transition-all duration-200 hover:bg-slate-800/70 ${
        isSelected ? 'ring-2 ring-amber-500 border-amber-500' : ''
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(paymentMethod)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-slate-300">
              {getCardIcon(paymentMethod.cardBrand)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">
                  {formatCardBrand(paymentMethod.cardBrand)} •••• {paymentMethod.cardLast4}
                </span>
                {paymentMethod.isDefault && (
                  <Badge variant="secondary" className="bg-amber-600/20 text-amber-300 border-amber-600/30">
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400">
                Expires {paymentMethod.cardExpMonth.toString().padStart(2, '0')}/{paymentMethod.cardExpYear}
              </p>
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-2">
              {!paymentMethod.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetDefault();
                  }}
                  disabled={isSettingDefault}
                  className="text-slate-400 hover:text-amber-400"
                >
                  {isSettingDefault ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDeleting}
                    className="text-slate-400 hover:text-red-400"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-800 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Remove Payment Method</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Are you sure you want to remove this payment method? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Remove Card
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}