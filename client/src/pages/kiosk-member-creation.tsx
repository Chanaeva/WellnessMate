import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";
import {
  UserPlus,
  CreditCard,
  Crown,
  Calendar,
  ArrowLeft,
  CheckCircle,
  Shield,
  Star,
  Zap,
  FileText,
} from "lucide-react";

// Stripe setup - fetch the public key from the server to support test/live key switching
const stripePromise = fetch("/api/stripe/config")
  .then((res) => res.json())
  .then(({ publicKey }) => loadStripe(publicKey));

// Form schemas
const memberFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  packageType: z.enum(["membership", "daypass"]),
  packageId: z.string().min(1, "Please select a package"),
});

type MemberFormData = z.infer<typeof memberFormSchema>;

// Agreement form schema
const agreementFormSchema = z.object({
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Address is required"),
  emergencyContact: z.string().min(1, "Emergency contact name is required"),
  emergencyPhone: z.string().min(1, "Emergency contact phone is required"),
  healthConfirmation: z.boolean().refine(val => val === true, "You must confirm your health status"),
  riskAcknowledgment: z.boolean().refine(val => val === true, "You must acknowledge the risks"),
  liabilityWaiver: z.boolean().refine(val => val === true, "You must accept the liability waiver"),
  rulesAcceptance: z.boolean().refine(val => val === true, "You must accept the facility rules"),
  ageConfirmation: z.boolean().refine(val => val === true, "You must confirm you are 18 or older"),
});

type AgreementFormData = z.infer<typeof agreementFormSchema>;

// Agreement Form Component
function AgreementForm({
  memberData,
  onComplete,
  onBack,
}: {
  memberData: MemberFormData;
  onComplete: (agreementData: AgreementFormData) => void;
  onBack: () => void;
}) {
  const form = useForm<AgreementFormData>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: {
      dateOfBirth: "",
      address: "",
      emergencyContact: "",
      emergencyPhone: "",
      healthConfirmation: false,
      riskAcknowledgment: false,
      liabilityWaiver: false,
      rulesAcceptance: false,
      ageConfirmation: false,
    },
  });

  const onSubmit = (data: AgreementFormData) => {
    onComplete(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <FileText className="h-6 w-6 mr-2" />
          Membership Agreement & Waiver
        </h2>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-amber-800 text-sm">
          <strong>Important:</strong> All members must sign this agreement before purchasing a membership or day pass. 
          Please read carefully and complete all required fields.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Member: <strong>{memberData.firstName} {memberData.lastName}</strong></p>
                <p className="text-sm text-gray-600">Email: <strong>{memberData.email}</strong></p>
              </div>

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-dob" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full address" {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact name" {...field} data-testid="input-emergency-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} data-testid="input-emergency-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Waivers and Acknowledgments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Waivers & Acknowledgments</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 border rounded-lg p-4 mb-4">
                <div className="text-sm space-y-3 text-gray-700">
                  <p><strong>HEALTH & SAFETY WAIVER</strong></p>
                  <p>I certify that I am in good physical condition and have no known medical conditions that would prevent me from safely participating in thermal wellness activities including saunas, steam rooms, cold plunges, and related facilities.</p>
                  
                  <p><strong>RISK ACKNOWLEDGMENT</strong></p>
                  <p>I understand that thermal wellness activities involve inherent risks including but not limited to heat exposure, cold exposure, slipping, and potential cardiovascular stress. I voluntarily assume all risks associated with using Wolf Mother Wellness facilities.</p>
                  
                  <p><strong>LIABILITY WAIVER</strong></p>
                  <p>I release Wolf Mother Wellness, its owners, operators, employees, and agents from any liability for injuries, damages, or losses I may incur while using the facilities, except in cases of gross negligence.</p>
                  
                  <p><strong>FACILITY RULES</strong></p>
                  <p>I agree to follow all posted facility rules and staff instructions. I will behave respectfully toward staff and other members. I understand that violation of rules may result in termination of my membership without refund.</p>
                </div>
              </ScrollArea>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="healthConfirmation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-health"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I confirm I am in good health and able to participate safely *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="riskAcknowledgment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-risk"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I understand and accept the risks of thermal wellness activities *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="liabilityWaiver"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-liability"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I accept the liability waiver and release terms *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rulesAcceptance"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-rules"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I agree to follow all facility rules and guidelines *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ageConfirmation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-age"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I confirm that I am 18 years of age or older *
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full text-lg py-6" data-testid="button-continue-payment">
            <CheckCircle className="h-5 w-5 mr-2" />
            I Agree - Continue to Payment
          </Button>
        </form>
      </Form>
    </div>
  );
}

// Discount data type
interface DiscountData {
  type: 'percentage' | 'fixed';
  value: number; // percentage (0-100) or fixed amount in dollars
  reason: string;
}

// Discount Form Component for staff-applied discounts
function DiscountForm({
  packageData,
  onComplete,
  onBack,
}: {
  packageData: any;
  onComplete: (discount: DiscountData | null) => void;
  onBack: () => void;
}) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountReason, setDiscountReason] = useState<string>('');
  
  const originalPrice = packageData.price; // in cents
  const discountValueNum = parseFloat(discountValue) || 0;
  
  // Calculate discount amount in cents
  let discountAmountCents = 0;
  if (discountValueNum > 0) {
    if (discountType === 'percentage') {
      discountAmountCents = Math.round(originalPrice * (discountValueNum / 100));
    } else {
      discountAmountCents = Math.round(discountValueNum * 100);
    }
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmountCents);
  
  // Validate discount bounds
  const isPercentageValid = discountType === 'percentage' && discountValueNum >= 0 && discountValueNum <= 100;
  const isFixedValid = discountType === 'fixed' && discountValueNum >= 0 && (discountValueNum * 100) <= originalPrice;
  const isDiscountValid = discountValueNum === 0 || (discountType === 'percentage' ? isPercentageValid : isFixedValid);
  
  const handleApplyDiscount = () => {
    // Validate percentage is 0-100
    if (discountType === 'percentage' && discountValueNum > 100) {
      return; // Button should be disabled, but extra safety
    }
    // Validate fixed amount doesn't exceed original price
    if (discountType === 'fixed' && (discountValueNum * 100) > originalPrice) {
      return; // Button should be disabled, but extra safety
    }
    
    if (discountValueNum > 0) {
      onComplete({
        type: discountType,
        value: discountValueNum,
        reason: discountReason,
      });
    } else {
      onComplete(null);
    }
  };
  
  const handleSkipDiscount = () => {
    onComplete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Zap className="h-6 w-6 mr-2" />
          Staff Discount
        </h2>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          <strong>Staff Only:</strong> Apply a discretionary discount to this day pass purchase if applicable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Package Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Package:</span>
            <span className="font-medium">{packageData.name}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">Original Price:</span>
            <span className="font-medium">${(originalPrice / 100).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Apply Discount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={discountType === 'percentage' ? 'default' : 'outline'}
              onClick={() => setDiscountType('percentage')}
              className="w-full"
              data-testid="button-discount-percentage"
            >
              Percentage (%)
            </Button>
            <Button
              type="button"
              variant={discountType === 'fixed' ? 'default' : 'outline'}
              onClick={() => setDiscountType('fixed')}
              className="w-full"
              data-testid="button-discount-fixed"
            >
              Fixed Amount ($)
            </Button>
          </div>

          <div>
            <Label htmlFor="discountValue">
              {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount ($)'}
            </Label>
            <div className="relative mt-1">
              <Input
                id="discountValue"
                type="number"
                min="0"
                max={discountType === 'percentage' ? '100' : (originalPrice / 100).toString()}
                step={discountType === 'percentage' ? '1' : '0.01'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 5.00'}
                className="pr-8"
                data-testid="input-discount-value"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {discountType === 'percentage' ? '%' : '$'}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="discountReason">Reason for Discount (Optional)</Label>
            <Input
              id="discountReason"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="e.g., Senior discount, Promo, etc."
              className="mt-1"
              data-testid="input-discount-reason"
            />
          </div>

          {discountValueNum > 0 && !isDiscountValid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">
                {discountType === 'percentage' 
                  ? 'Percentage must be between 0 and 100%' 
                  : `Fixed discount cannot exceed original price ($${(originalPrice / 100).toFixed(2)})`}
              </p>
            </div>
          )}
          
          {discountValueNum > 0 && isDiscountValid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Original Price:</span>
                <span className="line-through text-muted-foreground">${(originalPrice / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({discountType === 'percentage' ? `${discountValueNum}%` : `$${discountValueNum}`}):</span>
                <span>-${(discountAmountCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Final Price:</span>
                <span>${(finalPrice / 100).toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          onClick={handleSkipDiscount}
          className="text-lg py-6"
          data-testid="button-skip-discount"
        >
          No Discount
        </Button>
        <Button
          onClick={handleApplyDiscount}
          disabled={discountValueNum > 0 && !isDiscountValid}
          className="text-lg py-6"
          data-testid="button-apply-discount"
        >
          {discountValueNum > 0 ? `Apply Discount & Continue` : 'Continue to Payment'}
        </Button>
      </div>
    </div>
  );
}

// Payment form component
function PaymentForm({
  memberData,
  packageData,
  agreementData,
  discountData,
  onSuccess,
  onBack,
}: {
  memberData: MemberFormData;
  packageData: any;
  agreementData: AgreementFormData;
  discountData?: DiscountData | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Calculate final price with discount
  const originalPrice = packageData.price; // in cents
  let discountAmountCents = 0;
  
  if (discountData && discountData.value > 0) {
    if (discountData.type === 'percentage') {
      discountAmountCents = Math.round(originalPrice * (discountData.value / 100));
    } else {
      discountAmountCents = Math.round(discountData.value * 100); // convert dollars to cents
    }
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmountCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      // Create payment intent with discount if applicable
      const response = await apiRequest(
        "POST",
        "/api/kiosk/create-member-payment",
        {
          memberData,
          packageData: {
            ...packageData,
            finalPrice, // The discounted price in cents
            originalPrice, // Original price in cents
          },
          agreementData,
          discountData: discountData ? {
            type: discountData.type,
            value: discountData.value,
            reason: discountData.reason,
            amountCents: discountAmountCents,
          } : null,
        },
      );
      const { clientSecret, paymentIntentId } = await response.json();

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${memberData.firstName} ${memberData.lastName}`,
              email: memberData.email,
              phone: memberData.phoneNumber,
            },
          },
        },
      );

      if (error) {
        console.error("❌ Payment error:", error);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        console.log(
          "✅ Payment succeeded, confirming member creation...",
          paymentIntent.id,
        );
        // Payment succeeded, now create the member account
        try {
          const confirmResponse = await apiRequest(
            "POST",
            "/api/kiosk/confirm-member-creation",
            {
              paymentIntentId: paymentIntent.id,
              memberData,
              packageData: {
                ...packageData,
                finalPrice,
                originalPrice,
              },
              agreementData,
              discountData: discountData ? {
                type: discountData.type,
                value: discountData.value,
                reason: discountData.reason,
                amountCents: discountAmountCents,
              } : null,
            },
          );

          console.log("📝 Confirm response status:", confirmResponse.status);

          if (confirmResponse.ok) {
            const responseData = await confirmResponse.json();
            console.log("🎉 Member created successfully:", responseData);
            toast({
              title: "Member Created Successfully",
              description: `${memberData.firstName} ${memberData.lastName} has been registered and payment processed.`,
            });
            onSuccess();
          } else {
            const errorData = await confirmResponse.json();
            console.error("❌ Confirm member creation failed:", errorData);
            toast({
              title: "Member Creation Failed",
              description:
                errorData.message || "Failed to create member account",
              variant: "destructive",
            });
          }
        } catch (confirmError: any) {
          console.error(
            "❌ Error during confirm member creation:",
            confirmError,
          );
          toast({
            title: "Member Creation Failed",
            description:
              confirmError.message || "Failed to create member account",
            variant: "destructive",
          });
        }
      } else {
        console.warn(
          "⚠️ Payment intent status not succeeded:",
          paymentIntent?.status,
        );
      }
    } catch (error: any) {
      console.error("❌ Payment processing error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Payment Information</h2>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-semibold mb-4">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>
              Member: {memberData.firstName} {memberData.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Email: {memberData.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Package: {packageData.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Original Price:</span>
            <span className={discountData ? "line-through text-muted-foreground" : ""}>
              ${(originalPrice / 100).toFixed(2)}
            </span>
          </div>
          {discountData && discountAmountCents > 0 && (
            <>
              <div className="flex justify-between text-green-600">
                <span>
                  Discount ({discountData.type === 'percentage' ? `${discountData.value}%` : `$${discountData.value}`}):
                </span>
                <span>-${(discountAmountCents / 100).toFixed(2)}</span>
              </div>
              {discountData.reason && (
                <div className="text-sm text-muted-foreground italic">
                  Reason: {discountData.reason}
                </div>
              )}
            </>
          )}
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>Total:</span>
            <span>${(finalPrice / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-lg">
          <Label className="text-sm font-medium mb-4 block">
            Card Information
          </Label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "18px",
                  color: "#424770",
                  "::placeholder": {
                    color: "#aab7c4",
                  },
                },
              },
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full text-lg py-6"
          data-testid="button-pay"
        >
          {isProcessing ? "Processing Payment..." : `Pay $${(finalPrice / 100).toFixed(2)}`}
        </Button>
      </form>
    </div>
  );
}

export default function KioskMemberCreation({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "agreement" | "discount" | "payment" | "success">("form");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [agreementData, setAgreementData] = useState<AgreementFormData | null>(null);
  const [discountData, setDiscountData] = useState<DiscountData | null>(null);

  // Fetch membership plans
  const { data: membershipPlans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ["/api/membership-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/membership-plans");
      return await res.json();
    },
  });

  // Fetch punch card templates (day passes)
  const { data: punchCardTemplates = [], isLoading: isTemplatesLoading } =
    useQuery({
      queryKey: ["/api/punch-card-templates"],
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/punch-card-templates");
        return await res.json();
      },
    });

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      packageType: "membership",
      packageId: "",
    },
  });

  const packageType = form.watch("packageType");
  const packageId = form.watch("packageId");

  // Get selected package details
  const getSelectedPackageData = () => {
    if (!packageId) return null;

    if (packageType === "membership") {
      return membershipPlans.find(
        (plan: any) => plan.id.toString() === packageId,
      );
    } else {
      return punchCardTemplates.find(
        (template: any) => template.id.toString() === packageId,
      );
    }
  };

  const onSubmit = (data: MemberFormData) => {
    const packageData = getSelectedPackageData();
    if (!packageData) {
      toast({
        title: "Error",
        description: "Please select a package",
        variant: "destructive",
      });
      return;
    }

    setSelectedPackage({
      ...packageData,
      type: packageType,
      price:
        packageType === "membership"
          ? packageData.monthlyPrice
          : packageData.totalPrice,
    });
    setStep("agreement");
  };

  const handleAgreementComplete = (data: AgreementFormData) => {
    setAgreementData(data);
    // For day passes, show discount step; for memberships, go directly to payment
    if (selectedPackage?.type === "daypass") {
      setStep("discount");
    } else {
      setStep("payment");
    }
  };
  
  const handleDiscountComplete = (discount: DiscountData | null) => {
    setDiscountData(discount);
    setStep("payment");
  };

  const handlePaymentSuccess = () => {
    setStep("success");
    setTimeout(() => {
      onSuccess();
    }, 3000);
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case "vip":
        return Crown;
      case "premium":
        return Star;
      case "basic":
        return Shield;
      case "daily":
        return Calendar;
      default:
        return Shield;
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">
                Member Created Successfully!
              </h2>
              <p className="text-green-600">
                Welcome to Wolf Mother Wellness. Returning to main screen...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "agreement" && selectedPackage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <img
              src={logoMossGreen}
              alt="Wolf Mother Wellness"
              className="h-16 w-16"
            />
            <div className="ml-4">
              <h1 className="text-2xl font-bold">Wolf Mother Wellness</h1>
              <p className="text-gray-600">Member Registration</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-8">
              <AgreementForm
                memberData={form.getValues()}
                onComplete={handleAgreementComplete}
                onBack={() => setStep("form")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "discount" && selectedPackage && agreementData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <img
              src={logoMossGreen}
              alt="Wolf Mother Wellness"
              className="h-16 w-16"
            />
            <div className="ml-4">
              <h1 className="text-2xl font-bold">Wolf Mother Wellness</h1>
              <p className="text-gray-600">Staff Discount</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-8">
              <DiscountForm
                packageData={selectedPackage}
                onComplete={handleDiscountComplete}
                onBack={() => setStep("agreement")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "payment" && selectedPackage && agreementData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <img
              src={logoMossGreen}
              alt="Wolf Mother Wellness"
              className="h-16 w-16"
            />
            <div className="ml-4">
              <h1 className="text-2xl font-bold">Wolf Mother Wellness</h1>
              <p className="text-gray-600">Member Registration</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-8">
              <Elements stripe={stripePromise}>
                <PaymentForm
                  memberData={form.getValues()}
                  packageData={selectedPackage}
                  agreementData={agreementData}
                  discountData={discountData}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => selectedPackage?.type === "daypass" ? setStep("discount") : setStep("agreement")}
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <img
              src={logoMossGreen}
              alt="Wolf Mother Wellness"
              className="h-16 w-16"
            />
            <div className="ml-4">
              <h1 className="text-2xl font-bold">Wolf Mother Wellness</h1>
              <p className="text-gray-600">New Member Registration</p>
            </div>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Kiosk
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Member Information Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Romulus"
                              {...field}
                              className="text-lg py-3"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Lupus"
                              {...field}
                              className="text-lg py-3"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="romulus@tiber.river"
                            type="email"
                            {...field}
                            className="text-lg py-3"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(918) 555-WOLF"
                            {...field}
                            className="text-lg py-3"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="packageType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Type</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("packageId", ""); // Reset package selection when type changes
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="text-lg py-6">
                              <SelectValue placeholder="Select package type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="membership">
                              Monthly Membership
                            </SelectItem>
                            <SelectItem value="daypass">
                              Day Pass Package
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {packageType && (
                    <FormField
                      control={form.control}
                      name="packageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {packageType === "membership"
                              ? "Membership Plan"
                              : "Day Pass Package"}
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="text-lg py-6">
                                <SelectValue
                                  placeholder={`Select ${packageType === "membership" ? "membership plan" : "day pass package"}`}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {packageType === "membership"
                                ? membershipPlans.map((plan: any) => (
                                    <SelectItem
                                      key={plan.id}
                                      value={plan.id.toString()}
                                    >
                                      {plan.name} - $
                                      {(plan.monthlyPrice / 100).toFixed(2)}
                                      /month
                                    </SelectItem>
                                  ))
                                : punchCardTemplates.map((template: any) => (
                                    <SelectItem
                                      key={template.id}
                                      value={template.id.toString()}
                                    >
                                      {template.name} - $
                                      {(template.totalPrice / 100).toFixed(2)}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="submit"
                    className="w-full text-lg py-6"
                    disabled={!packageId}
                  >
                    Continue to Payment
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Package Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Package Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {packageId ? (
                <div className="space-y-4">
                  {(() => {
                    const packageData = getSelectedPackageData();
                    if (!packageData) return null;

                    const Icon =
                      packageType === "membership"
                        ? getPlanIcon(packageData.planType)
                        : Calendar;

                    return (
                      <div className="border rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <div className="bg-primary/10 p-3 rounded-full mr-4">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {packageData.name}
                            </h3>
                            <p className="text-green-600 font-bold text-xl">
                              $
                              {packageType === "membership"
                                ? (packageData.monthlyPrice / 100).toFixed(2)
                                : (packageData.totalPrice / 100).toFixed(2)}
                              {packageType === "membership" && "/month"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            {packageData.description}
                          </p>

                          {packageType === "membership" &&
                            packageData.features && (
                              <ul className="text-sm space-y-1 mt-4">
                                {packageData.features.map(
                                  (feature: string, index: number) => (
                                    <li
                                      key={index}
                                      className="flex items-center"
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                                      {feature}
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}

                          {packageType === "daypass" && (
                            <div className="mt-4">
                              <p className="text-sm font-medium">
                                {packageData.totalPunches} visits included
                              </p>
                              <p className="text-xs text-gray-500">
                                $
                                {(
                                  packageData.totalPrice /
                                  packageData.totalPunches
                                ).toFixed(2)}{" "}
                                per visit
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a package to see details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
