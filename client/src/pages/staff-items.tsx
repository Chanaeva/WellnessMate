import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ShoppingCart, ArrowLeft, Search, User, Calendar, CreditCard, Loader2, X, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { StaffItemPaymentDialog } from "@/components/payment/staff-item-payment-form";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Stripe setup - fetch the public key from the server
const stripePromise = fetch('/api/stripe/config')
  .then(res => res.json())
  .then(({ publicKey }) => loadStripe(publicKey));

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  size: string | null;
  quantityTotal: number;
  quantityAvailable: number;
  priceInCents: number;
  isActive: boolean;
  description: string | null;
};

type MemberSearchResult = {
  id: number;
  username: string;
  email: string;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  membership?: {
    membershipId: string;
    status: string;
    planType: string;
  };
};

type ItemCheckout = {
  id: number;
  itemId: number;
  userId: number;
  checkedOutAt: string;
  checkedInAt: string | null;
  status: string;
  notes: string | null;
  paymentStatus: 'not_charged' | 'charged' | 'failed';
  chargedAmountCents: number | null;
  chargedAt: string | null;
  item?: InventoryItem;
  user?: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

type PaymentStatus = {
  hasPaymentMethod: boolean;
  paymentMethod: {
    cardLast4: string;
    cardBrand: string;
  } | null;
};

type PaymentDialogData = {
  checkoutId: number;
  itemName: string;
  priceInCents: number;
  memberName: string;
  memberEmail?: string;
  userId: number;
};

type StaffItemsProps = {
  embedded?: boolean;
};

// Stripe element styles
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
    },
    invalid: {
      color: '#ef4444',
    },
  },
};

interface InlinePaymentFormProps {
  userId: number;
  itemId: number;
  quantity: number;
  totalPriceCents: number;
  memberName: string;
  memberEmail?: string;
  itemName: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  isCheckoutPending: boolean;
  savedPaymentMethod?: {
    cardLast4: string;
    cardBrand: string;
  } | null;
}

function InlinePaymentFormContent({
  userId,
  itemId,
  quantity,
  totalPriceCents,
  memberName,
  memberEmail,
  itemName,
  onSuccess,
  onCancel,
  isCheckoutPending,
  savedPaymentMethod,
}: InlinePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'saved' | 'new_card' | 'card_reader'>(
    savedPaymentMethod ? 'saved' : 'new_card'
  );
  const [readerMessage, setReaderMessage] = useState<string | null>(null);
  const [availableReaders, setAvailableReaders] = useState<any[]>([]);
  const [selectedReaderId, setSelectedReaderId] = useState<string>("");

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/staff/item-checkout-payment-intent", {
        userId,
        itemId,
        quantity,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create payment");
      }
      return await res.json();
    },
  });

  const chargeSavedCardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/staff/item-checkout-charge-saved", {
        userId,
        itemId,
        quantity,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to charge saved card");
      }
      return await res.json();
    },
  });

  const discoverReaders = async () => {
    setCardError(null);
    setReaderMessage('Searching for card readers...');
    try {
      const discoverRes = await fetch('/api/stripe/terminal/discover-readers');
      if (!discoverRes.ok) throw new Error('Failed to discover card readers');
      const { readers } = await discoverRes.json();
      if (!readers || readers.length === 0) {
        throw new Error('No card readers found. Please ensure a reader is connected and online.');
      }
      setAvailableReaders(readers);
      if (readers.length === 1) {
        setSelectedReaderId(readers[0].id);
      }
      setReaderMessage(null);
    } catch (error: any) {
      setCardError(error.message);
      setReaderMessage(null);
    }
  };

  useEffect(() => {
    if (paymentMode === 'card_reader') {
      discoverReaders();
    } else {
      setAvailableReaders([]);
      setSelectedReaderId("");
    }
  }, [paymentMode]);

  const handleCardReaderPayment = async () => {
    if (!selectedReaderId) {
      setCardError('Please select a card reader first.');
      return;
    }

    const reader = availableReaders.find((r: any) => r.id === selectedReaderId);
    if (!reader) {
      setCardError('Selected reader not found. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);
    setCardError(null);
    setReaderMessage(`Using reader: ${reader.label || reader.serial_number}. Creating payment...`);

    try {
      const intentRes = await apiRequest("POST", "/api/staff/item-checkout-terminal-intent", {
        userId,
        itemId,
        quantity,
      });
      if (!intentRes.ok) {
        const error = await intentRes.json();
        throw new Error(error.message || "Failed to create terminal payment");
      }
      const { paymentIntentId } = await intentRes.json();

      setReaderMessage('Please tap, insert, or swipe card on the reader...');

      const processRes = await fetch('/api/stripe/terminal/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readerId: reader.id, paymentIntentId }),
      });

      if (!processRes.ok) {
        const error = await processRes.json();
        throw new Error(error.message || 'Failed to send payment to reader');
      }

      const maxPolls = 120;
      let pollCount = 0;
      let readerActionDone = false;

      while (pollCount < maxPolls && !readerActionDone) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusRes = await fetch(`/api/stripe/terminal/reader-status/${reader.id}`);
        const statusResult = await statusRes.json();

        if (statusResult.action) {
          if (statusResult.action.status === 'succeeded') {
            readerActionDone = true;
          } else if (statusResult.action.status === 'failed') {
            throw new Error(statusResult.action.failure_message || 'Payment failed on reader');
          }
        } else {
          readerActionDone = true;
        }
        pollCount++;
      }

      if (!readerActionDone) {
        throw new Error('Card reader timed out. Please try again.');
      }

      setReaderMessage('Card accepted! Processing payment...');

      let paymentSucceeded = false;
      let piPollCount = 0;
      const maxPiPolls = 30;

      while (piPollCount < maxPiPolls && !paymentSucceeded) {
        const piRes = await fetch(`/api/stripe/payment-intent-status/${paymentIntentId}`);
        if (piRes.ok) {
          const piStatus = await piRes.json();
          if (piStatus.status === 'succeeded') {
            paymentSucceeded = true;
          } else if (piStatus.status === 'canceled' || piStatus.status === 'requires_payment_method') {
            throw new Error('Payment was declined. Please try a different card.');
          }
        }
        if (!paymentSucceeded) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          piPollCount++;
        }
      }

      if (!paymentSucceeded) {
        throw new Error('Payment processing timed out. The charge may still complete — please check before retrying.');
      }

      onSuccess(paymentIntentId);
    } catch (error: any) {
      setCardError(error.message);
      toast({
        title: "Card Reader Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setReaderMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (paymentMode === 'card_reader') {
      handleCardReaderPayment();
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      if (paymentMode === 'saved' && savedPaymentMethod) {
        const result = await chargeSavedCardMutation.mutateAsync();
        if (result.paymentIntentId) {
          onSuccess(result.paymentIntentId);
        } else {
          throw new Error("Payment was not completed");
        }
      } else {
        if (!stripe || !elements) {
          return;
        }

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
          onSuccess(paymentIntent.id);
        } else {
          throw new Error("Payment was not completed");
        }
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

  const isLoading = isProcessing || createPaymentIntentMutation.isPending || chargeSavedCardMutation.isPending || isCheckoutPending;

  const formatCardBrand = (brand: string) => {
    const brands: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
    };
    return brands[brand.toLowerCase()] || brand;
  };

  const PaymentOption = ({ mode, label, sublabel, icon }: { mode: 'saved' | 'new_card' | 'card_reader'; label: string; sublabel?: string; icon?: any }) => (
    <div 
      className={`p-3 border rounded-md cursor-pointer transition-colors ${paymentMode === mode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:border-gray-300'}`}
      onClick={() => !isLoading && setPaymentMode(mode)}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === mode ? 'border-blue-500' : 'border-gray-300'}`}>
          {paymentMode === mode && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{label}</p>
          {sublabel && <p className="text-xs text-slate-600 dark:text-slate-400">{sublabel}</p>}
        </div>
        {icon}
      </div>
    </div>
  );

  return (
    <Card className="border-blue-300 bg-blue-50/50 dark:bg-blue-900/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Payment Details
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Charging ${(totalPriceCents / 100).toFixed(2)} for {quantity}x {itemName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <PaymentOption
              mode="card_reader"
              label="Use card reader"
              sublabel="Tap, insert, or swipe on the physical reader"
              icon={<Smartphone className="h-4 w-4 text-slate-400" />}
            />
            {savedPaymentMethod && (
              <PaymentOption
                mode="saved"
                label="Use saved card"
                sublabel={`${formatCardBrand(savedPaymentMethod.cardBrand)} ending in ${savedPaymentMethod.cardLast4}`}
              />
            )}
            <PaymentOption
              mode="new_card"
              label="Enter new card"
            />
          </div>

          {paymentMode === 'card_reader' && (
            <div className="space-y-2">
              {availableReaders.length === 0 && !cardError && (
                <p className="text-sm text-muted-foreground">Searching for readers...</p>
              )}
              {availableReaders.length > 1 && (
                <div className="space-y-1">
                  <Label>Select Reader</Label>
                  <select
                    className="w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900"
                    value={selectedReaderId}
                    onChange={(e) => setSelectedReaderId(e.target.value)}
                  >
                    <option value="">Choose a reader...</option>
                    {availableReaders.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.label || r.serial_number} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {availableReaders.length === 1 && (
                <p className="text-sm text-muted-foreground">
                  Reader: {availableReaders[0].label || availableReaders[0].serial_number}
                </p>
              )}
            </div>
          )}

          {paymentMode === 'new_card' && (
            <>
              <div className="space-y-2">
                <Label>Card Number</Label>
                <div className="border rounded-md p-3 bg-white dark:bg-slate-900">
                  <CardNumberElement options={elementOptions} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <div className="border rounded-md p-3 bg-white dark:bg-slate-900">
                    <CardExpiryElement options={elementOptions} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <div className="border rounded-md p-3 bg-white dark:bg-slate-900">
                    <CardCvcElement options={elementOptions} />
                  </div>
                </div>
              </div>
            </>
          )}

          {paymentMode === 'card_reader' && readerMessage && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{readerMessage}</p>
              </div>
            </div>
          )}

          {cardError && (
            <p className="text-sm text-red-600">{cardError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={(paymentMode === 'new_card' && !stripe) || isLoading}
            data-testid="button-process-payment"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {paymentMode === 'card_reader' ? 'Waiting for card reader...' : 'Processing...'}
              </>
            ) : paymentMode === 'card_reader' ? (
              <>
                <Smartphone className="h-4 w-4 mr-2" />
                {`Pay $${(totalPriceCents / 100).toFixed(2)} via Card Reader`}
              </>
            ) : (
              `Pay $${(totalPriceCents / 100).toFixed(2)} & Checkout`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InlinePaymentForm(props: InlinePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <InlinePaymentFormContent {...props} />
    </Elements>
  );
}

export default function StaffItems({ embedded = false }: StaffItemsProps) {
  const [activeTab, setActiveTab] = useState("checkout");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkinDialog, setCheckinDialog] = useState<ItemCheckout | null>(null);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogData | null>(null);
  const [memberPaymentStatus, setMemberPaymentStatus] = useState<Record<number, PaymentStatus>>({});
  const [showInlinePayment, setShowInlinePayment] = useState(false);
  const [selectedMemberPaymentInfo, setSelectedMemberPaymentInfo] = useState<PaymentStatus | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset payment info when member changes
  useEffect(() => {
    setShowInlinePayment(false);
    setSelectedMemberPaymentInfo(null);
  }, [selectedMember]);

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/staff/inventory/items'],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<MemberSearchResult[]>({
    queryKey: ['/api/staff/search-members', debouncedSearchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/staff/search-members?query=${encodeURIComponent(debouncedSearchTerm)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to search members');
      }
      return response.json();
    },
    enabled: debouncedSearchTerm.length >= 2,
  });

  const { data: activeCheckouts = [], isLoading: checkoutsLoading } = useQuery<ItemCheckout[]>({
    queryKey: ['/api/staff/checkouts/active'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { itemId: number; userId: number; notes?: string; quantity?: number; paymentIntentId?: string }) => {
      const response = await apiRequest("POST", "/api/staff/checkouts", data);
      return response.json();
    },
    onSuccess: (data) => {
      const qty = data.quantity || 1;
      toast({
        title: "Item Checked Out",
        description: `${qty} item${qty > 1 ? 's' : ''} checked out successfully${data.charged ? ` - $${(data.chargedAmount / 100).toFixed(2)} charged` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/inventory/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
      setSelectedMember(null);
      setSelectedItemId("");
      setQuantity(1);
      setCheckoutNotes("");
      setSearchTerm("");
      setShowInlinePayment(false);
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Unable to checkout item",
        variant: "destructive",
      });
    }
  });

  const checkinMutation = useMutation({
    mutationFn: async (data: { id: number; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/staff/checkouts/${data.id}/checkin`, {
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Checked In",
        description: "Item has been returned successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/inventory/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
      setCheckinDialog(null);
      setCheckinNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Checkin Failed",
        description: error.message || "Unable to checkin item",
        variant: "destructive",
      });
    }
  });

  const chargeMutation = useMutation({
    mutationFn: async (data: { checkoutId: number; userId: number }) => {
      const response = await apiRequest("POST", `/api/staff/checkouts/${data.checkoutId}/charge`, {});
      return { ...(await response.json()), userId: data.userId };
    },
    onSuccess: (data: any) => {
      toast({
        title: "Charge Successful",
        description: `$${(data.amountCharged / 100).toFixed(2)} has been charged to the member's card`,
      });
      if (data.userId) {
        setMemberPaymentStatus(prev => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
    },
    onError: (error: any) => {
      toast({
        title: "Charge Failed",
        description: error.message || "Unable to charge the member",
        variant: "destructive",
      });
    }
  });

  const fetchPaymentStatus = async (userId: number): Promise<PaymentStatus> => {
    if (memberPaymentStatus[userId]) {
      return memberPaymentStatus[userId];
    }
    
    try {
      const response = await fetch(`/api/staff/members/${userId}/payment-status`, {
        credentials: 'include',
      });
      if (response.ok) {
        const status = await response.json();
        setMemberPaymentStatus(prev => ({ ...prev, [userId]: status }));
        return status;
      }
    } catch (error) {
      console.error("Failed to fetch payment status:", error);
    }
    
    return { hasPaymentMethod: false, paymentMethod: null };
  };

  const handleChargeClick = async (checkout: ItemCheckout) => {
    if (!checkout.user || !checkout.item) return;
    
    const userId = checkout.userId;
    const paymentStatus = await fetchPaymentStatus(userId);
    
    if (paymentStatus.hasPaymentMethod) {
      chargeMutation.mutate({ checkoutId: checkout.id, userId });
    } else {
      setPaymentDialog({
        checkoutId: checkout.id,
        itemName: `${checkout.item.name}${checkout.item.size ? ` (${checkout.item.size})` : ''}`,
        priceInCents: checkout.item.priceInCents,
        memberName: `${checkout.user.firstName} ${checkout.user.lastName}`,
        memberEmail: checkout.user.email,
        userId: checkout.userId,
      });
    }
  };

  // Get the selected item details
  const selectedItem = items.find(item => item.id.toString() === selectedItemId);
  const itemHasPrice = selectedItem && selectedItem.priceInCents > 0;
  const totalPrice = selectedItem ? selectedItem.priceInCents * quantity : 0;

  const handleCheckout = async () => {
    if (!selectedMember || !selectedItemId) {
      toast({
        title: "Missing Information",
        description: "Please select both a member and an item",
        variant: "destructive",
      });
      return;
    }

    // If item has a price, fetch payment status and show inline payment form
    if (itemHasPrice) {
      const paymentStatus = await fetchPaymentStatus(selectedMember.id);
      setSelectedMemberPaymentInfo(paymentStatus);
      setShowInlinePayment(true);
      return;
    }

    // For free items, proceed directly to checkout
    checkoutMutation.mutate({
      itemId: parseInt(selectedItemId),
      userId: selectedMember.id,
      quantity: quantity,
      notes: checkoutNotes || undefined
    });
  };

  // Handle checkout with payment (called after payment is processed)
  const handleCheckoutWithPayment = (paymentIntentId: string) => {
    if (!selectedMember || !selectedItemId) return;
    
    checkoutMutation.mutate({
      itemId: parseInt(selectedItemId),
      userId: selectedMember.id,
      quantity: quantity,
      notes: checkoutNotes || undefined,
      paymentIntentId: paymentIntentId
    });
  };

  const handleCheckin = () => {
    if (!checkinDialog) return;
    
    checkinMutation.mutate({
      id: checkinDialog.id,
      notes: checkinNotes || undefined
    });
  };

  const availableItems = items.filter(item => item.isActive && item.quantityAvailable > 0);

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-8 w-8" />
              Item Checkout
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage robes, shoes, and other items for members
            </p>
          </div>
          <Link href="/staff/check-in">
            <Button variant="outline" data-testid="button-back-to-checkin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Check-in
            </Button>
          </Link>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checkout" data-testid="tab-checkout">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Checkout Item
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active-checkouts">
              <Package className="h-4 w-4 mr-2" />
              Active Checkouts ({activeCheckouts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkout" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Checkout Item to Member</CardTitle>
                <CardDescription>
                  Search for a member and select an item to checkout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="member-search">Search Member</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="member-search"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-member-search"
                    />
                  </div>

                  {selectedMember && (
                    <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-8 w-8 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white" data-testid="text-selected-member-name">
                                {selectedMember.firstName} {selectedMember.lastName}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {selectedMember.email}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedMember(null)}
                            data-testid="button-clear-member"
                          >
                            Clear
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {searchResults && searchResults.length > 0 && !selectedMember && (
                    <Card>
                      <CardContent className="p-0">
                        <div className="max-h-64 overflow-y-auto">
                          {searchResults.map((member) => (
                            <button
                              key={member.id}
                              onClick={() => {
                                setSelectedMember(member);
                                setSearchTerm("");
                              }}
                              className="w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-b-0 transition-colors"
                              data-testid={`button-select-member-${member.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {member.firstName} {member.lastName}
                                  </p>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {member.email}
                                  </p>
                                </div>
                                {member.membership && (
                                  <Badge variant={member.membership.status === 'active' ? 'default' : 'secondary'}>
                                    {member.membership.planType}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-select">Select Item</Label>
                  <Select value={selectedItemId} onValueChange={(value) => {
                    setSelectedItemId(value);
                    setQuantity(1);
                    setShowInlinePayment(false);
                  }}>
                    <SelectTrigger id="item-select" data-testid="select-item">
                      <SelectValue placeholder="Choose an item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()} data-testid={`select-item-option-${item.id}`}>
                          {item.name} {item.size && `(${item.size})`} - {item.quantityAvailable} available
                          {item.priceInCents > 0 && ` - $${(item.priceInCents / 100).toFixed(2)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity Field */}
                {selectedItem && (
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Select 
                      value={quantity.toString()} 
                      onValueChange={(value) => {
                        setQuantity(parseInt(value));
                        setShowInlinePayment(false);
                      }}
                    >
                      <SelectTrigger id="quantity" data-testid="select-quantity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.min(selectedItem.quantityAvailable, 10) }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()} data-testid={`select-quantity-option-${num}`}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Price Display */}
                {selectedItem && itemHasPrice && (
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {quantity} x ${(selectedItem.priceInCents / 100).toFixed(2)}
                          </p>
                          <p className="font-semibold text-lg text-slate-900 dark:text-white" data-testid="text-total-price">
                            Total: ${(totalPrice / 100).toFixed(2)}
                          </p>
                        </div>
                        <CreditCard className="h-6 w-6 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="checkout-notes">Notes (Optional)</Label>
                  <Textarea
                    id="checkout-notes"
                    placeholder="Add any notes about this checkout..."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    rows={3}
                    data-testid="textarea-checkout-notes"
                  />
                </div>

                {/* Inline Payment Form for priced items */}
                {showInlinePayment && selectedMember && selectedItem && itemHasPrice && (
                  <InlinePaymentForm
                    userId={selectedMember.id}
                    itemId={selectedItem.id}
                    quantity={quantity}
                    totalPriceCents={totalPrice}
                    memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
                    memberEmail={selectedMember.email}
                    itemName={`${selectedItem.name}${selectedItem.size ? ` (${selectedItem.size})` : ''}`}
                    onSuccess={handleCheckoutWithPayment}
                    onCancel={() => setShowInlinePayment(false)}
                    isCheckoutPending={checkoutMutation.isPending}
                    savedPaymentMethod={selectedMemberPaymentInfo?.paymentMethod}
                  />
                )}

                {!showInlinePayment && (
                  <Button 
                    onClick={handleCheckout}
                    disabled={!selectedMember || !selectedItemId || checkoutMutation.isPending}
                    className="w-full"
                    data-testid="button-checkout-item"
                  >
                    {checkoutMutation.isPending ? "Checking Out..." : itemHasPrice ? `Checkout & Pay $${(totalPrice / 100).toFixed(2)}` : "Checkout Item"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Checkouts</CardTitle>
                <CardDescription>
                  Items currently checked out to members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checkoutsLoading ? (
                  <div className="text-center py-8 text-slate-500" data-testid="text-loading">
                    Loading checkouts...
                  </div>
                ) : activeCheckouts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500" data-testid="text-no-checkouts">
                    No active checkouts
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Checked Out</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCheckouts.map((checkout) => (
                          <TableRow key={checkout.id} data-testid={`row-checkout-${checkout.id}`}>
                            <TableCell className="font-medium">
                              {checkout.item?.name} {checkout.item?.size && `(${checkout.item.size})`}
                            </TableCell>
                            <TableCell>
                              {checkout.user?.firstName} {checkout.user?.lastName}
                            </TableCell>
                            <TableCell>
                              {checkout.item?.priceInCents && checkout.item.priceInCents > 0 
                                ? `$${(checkout.item.priceInCents / 100).toFixed(2)}` 
                                : <span className="text-slate-400">Free</span>}
                            </TableCell>
                            <TableCell>
                              {checkout.paymentStatus === 'charged' ? (
                                <Badge variant="default" className="bg-green-600">
                                  Charged ${checkout.chargedAmountCents ? (checkout.chargedAmountCents / 100).toFixed(2) : ''}
                                </Badge>
                              ) : checkout.paymentStatus === 'failed' ? (
                                <Badge variant="destructive">Failed</Badge>
                              ) : checkout.item?.priceInCents && checkout.item.priceInCents > 0 ? (
                                <Badge variant="secondary">Not Charged</Badge>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Calendar className="h-4 w-4" />
                                {new Date(checkout.checkedOutAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {checkout.item?.priceInCents && checkout.item.priceInCents > 0 && checkout.paymentStatus !== 'charged' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleChargeClick(checkout)}
                                    disabled={chargeMutation.isPending}
                                    data-testid={`button-charge-${checkout.id}`}
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {chargeMutation.isPending ? "Charging..." : "Charge"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setCheckinDialog(checkout);
                                    setCheckinNotes("");
                                  }}
                                  data-testid={`button-checkin-${checkout.id}`}
                                >
                                  Check In
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      <Dialog open={!!checkinDialog} onOpenChange={(open) => !open && setCheckinDialog(null)}>
        <DialogContent data-testid="dialog-checkin">
          <DialogHeader>
            <DialogTitle>Check In Item</DialogTitle>
            <DialogDescription>
              Confirm checking in {checkinDialog?.item?.name} from {checkinDialog?.user?.firstName} {checkinDialog?.user?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-notes">Return Notes (Optional)</Label>
              <Textarea
                id="checkin-notes"
                placeholder="Add any notes about the return condition..."
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                rows={3}
                data-testid="textarea-checkin-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCheckinDialog(null)}
              data-testid="button-cancel-checkin"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCheckin}
              disabled={checkinMutation.isPending}
              data-testid="button-confirm-checkin"
            >
              {checkinMutation.isPending ? "Checking In..." : "Confirm Check In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {paymentDialog && (
        <StaffItemPaymentDialog
          open={!!paymentDialog}
          checkoutId={paymentDialog.checkoutId}
          itemName={paymentDialog.itemName}
          priceInCents={paymentDialog.priceInCents}
          memberName={paymentDialog.memberName}
          memberEmail={paymentDialog.memberEmail}
          onSuccess={() => {
            setMemberPaymentStatus(prev => {
              const updated = { ...prev };
              delete updated[paymentDialog.userId];
              return updated;
            });
            setPaymentDialog(null);
            queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
          }}
          onClose={() => setPaymentDialog(null)}
        />
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {content}
      </div>
    </div>
  );
}
