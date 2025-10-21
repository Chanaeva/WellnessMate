import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
  Zap
} from "lucide-react";

// Stripe setup - fetch the public key from the server to support test/live key switching
const stripePromise = fetch('/api/stripe/config')
  .then(res => res.json())
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

// Payment form component
function PaymentForm({ memberData, packageData, onSuccess, onBack }: {
  memberData: MemberFormData;
  packageData: any;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      // Create payment intent
      const response = await apiRequest("POST", "/api/kiosk/create-member-payment", {
        memberData,
        packageData,
      });
      const { clientSecret, paymentIntentId } = await response.json();

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${memberData.firstName} ${memberData.lastName}`,
            email: memberData.email,
            phone: memberData.phoneNumber,
          },
        },
      });

      if (error) {
        console.error('❌ Payment error:', error);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Payment succeeded, confirming member creation...', paymentIntent.id);
        // Payment succeeded, now create the member account
        try {
          const confirmResponse = await apiRequest("POST", "/api/kiosk/confirm-member-creation", {
            paymentIntentId: paymentIntent.id,
            memberData,
            packageData,
          });
          
          console.log('📝 Confirm response status:', confirmResponse.status);
          
          if (confirmResponse.ok) {
            const responseData = await confirmResponse.json();
            console.log('🎉 Member created successfully:', responseData);
            toast({
              title: "Member Created Successfully",
              description: `${memberData.firstName} ${memberData.lastName} has been registered and payment processed.`,
            });
            onSuccess();
          } else {
            const errorData = await confirmResponse.json();
            console.error('❌ Confirm member creation failed:', errorData);
            toast({
              title: "Member Creation Failed",
              description: errorData.message || "Failed to create member account",
              variant: "destructive",
            });
          }
        } catch (confirmError: any) {
          console.error('❌ Error during confirm member creation:', confirmError);
          toast({
            title: "Member Creation Failed",
            description: confirmError.message || "Failed to create member account",
            variant: "destructive",
          });
        }
      } else {
        console.warn('⚠️ Payment intent status not succeeded:', paymentIntent?.status);
      }
    } catch (error: any) {
      console.error('❌ Payment processing error:', error);
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
            <span>Member: {memberData.firstName} {memberData.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span>Email: {memberData.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Package: {packageData.name}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>Total:</span>
            <span>${(packageData.price / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border rounded-lg">
          <Label className="text-sm font-medium mb-4 block">Card Information</Label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '18px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
              },
            }}
          />
        </div>
        
        <Button type="submit" disabled={!stripe || isProcessing} className="w-full text-lg py-6">
          {isProcessing ? "Processing Payment..." : `Pay $${packageData.price}`}
        </Button>
      </form>
    </div>
  );
}

export default function KioskMemberCreation({ onBack, onSuccess }: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  // Fetch membership plans
  const { data: membershipPlans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ["/api/membership-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/membership-plans");
      return await res.json();
    },
  });

  // Fetch punch card templates (day passes)
  const { data: punchCardTemplates = [], isLoading: isTemplatesLoading } = useQuery({
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
      return membershipPlans.find((plan: any) => plan.id.toString() === packageId);
    } else {
      return punchCardTemplates.find((template: any) => template.id.toString() === packageId);
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
      price: packageType === "membership" ? packageData.monthlyPrice : packageData.totalPrice
    });
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
      case 'vip': return Crown;
      case 'premium': return Star;
      case 'basic': return Shield;
      case 'daily': return Calendar;
      default: return Shield;
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">Member Created Successfully!</h2>
              <p className="text-green-600">
                Welcome to Wolf Mother Wellness. Returning to main screen...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "payment" && selectedPackage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <img src={logoMossGreen} alt="Wolf Mother Wellness" className="h-16 w-16" />
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
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep("form")}
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
            <img src={logoMossGreen} alt="Wolf Mother Wellness" className="h-16 w-16" />
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Romulus" {...field} className="text-lg py-3" />
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
                            <Input placeholder="Lupus" {...field} className="text-lg py-3" />
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
                          <Input placeholder="romulus@tiber.river" type="email" {...field} className="text-lg py-3" />
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
                          <Input placeholder="(918) 555-WOLF" {...field} className="text-lg py-3" />
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
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("packageId", ""); // Reset package selection when type changes
                        }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-lg py-6">
                              <SelectValue placeholder="Select package type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="membership">Monthly Membership</SelectItem>
                            <SelectItem value="daypass">Day Pass Package</SelectItem>
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
                            {packageType === "membership" ? "Membership Plan" : "Day Pass Package"}
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-lg py-6">
                                <SelectValue placeholder={`Select ${packageType === "membership" ? "membership plan" : "day pass package"}`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {packageType === "membership" ? (
                                membershipPlans.map((plan: any) => {
                                  const Icon = getPlanIcon(plan.planType);
                                  return (
                                    <SelectItem key={plan.id} value={plan.id.toString()}>
                                      <div className="flex items-center">
                                        <Icon className="h-4 w-4 mr-2" />
                                        {plan.name} - ${(plan.monthlyPrice / 100).toFixed(2)}/month
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                punchCardTemplates.map((template: any) => (
                                  <SelectItem key={template.id} value={template.id.toString()}>
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-2" />
                                      {template.name} - ${(template.totalPrice / 100).toFixed(2)}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button type="submit" className="w-full text-lg py-6" disabled={!packageId}>
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
                    
                    const Icon = packageType === "membership" 
                      ? getPlanIcon(packageData.planType) 
                      : Calendar;
                    
                    return (
                      <div className="border rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <div className="bg-primary/10 p-3 rounded-full mr-4">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{packageData.name}</h3>
                            <p className="text-green-600 font-bold text-xl">
                              ${(packageType === "membership" ? packageData.monthlyPrice : packageData.totalPrice) / 100}
                              {packageType === "membership" && "/month"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">{packageData.description}</p>
                          
                          {packageType === "membership" && packageData.features && (
                            <ul className="text-sm space-y-1 mt-4">
                              {packageData.features.map((feature: string, index: number) => (
                                <li key={index} className="flex items-center">
                                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}
                          
                          {packageType === "daypass" && (
                            <div className="mt-4">
                              <p className="text-sm font-medium">
                                {packageData.totalPunches} visits included
                              </p>
                              <p className="text-xs text-gray-500">
                                ${(packageData.totalPrice / packageData.totalPunches).toFixed(2)} per visit
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