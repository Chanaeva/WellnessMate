import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Trash2, Star, Loader2 } from "lucide-react";
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
      className={`bg-white border-gray-200 transition-all duration-200 hover:bg-gray-50 ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={() => onSelect?.(paymentMethod)}
      data-testid={`payment-method-card-${paymentMethod.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-gray-600">
              {getCardIcon(paymentMethod.cardBrand)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 font-medium">
                  {formatCardBrand(paymentMethod.cardBrand)} •••• {paymentMethod.cardLast4}
                </span>
                {paymentMethod.isDefault && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">
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
                  className="text-gray-500 hover:text-primary"
                  title="Set as default"
                  data-testid={`button-set-default-${paymentMethod.id}`}
                >
                  {isSettingDefault ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4" />
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
                    className="text-gray-500 hover:text-red-500"
                    data-testid={`button-delete-payment-method-${paymentMethod.id}`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove this payment method? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
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