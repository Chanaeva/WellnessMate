import { useState, useEffect, useRef } from "react";
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
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Separator } from "@/components/ui/separator";
import { loadStripeTerminal, Terminal } from "@stripe/terminal-js";
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
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  HelpCircle,
  Radio,
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
  password: z.string().optional(),
  packageType: z.enum(["membership", "daypass"]),
  packageId: z.string().min(1, "Please select a package"),
});

type MemberFormData = z.infer<typeof memberFormSchema>;

// Agreement form schema
const agreementFormSchema = z.object({
  dateOfBirth: z.string().min(1, "Date of birth is required"),
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
  
  // Use totalPrice for multi-membership purchases, otherwise use unit price
  const originalPrice = packageData.totalPrice || packageData.price; // in cents
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

// Payment form component with Stripe Terminal card reader support
function PaymentForm({
  memberData,
  packageData,
  agreementData,
  discountData,
  onSuccess,
  onBack,
  existingMemberId,
}: {
  memberData: MemberFormData;
  packageData: any;
  agreementData: AgreementFormData;
  discountData?: DiscountData | null;
  onSuccess: () => void;
  onBack: () => void;
  existingMemberId?: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'reader' | 'manual'>('manual');
  const [readerStatus, setReaderStatus] = useState<'initializing' | 'searching' | 'found' | 'connecting' | 'connected' | 'waiting' | 'processing' | 'error' | 'idle' | 'ready'>('idle');
  const [readerMessage, setReaderMessage] = useState<string>('');
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [connectedReader, setConnectedReader] = useState<any>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [selectedServerReader, setSelectedServerReader] = useState<any>(null); // For server-driven flow
  const [useServerDriven, setUseServerDriven] = useState(true); // Default to server-driven for WisePOS E
  const [billingZip, setBillingZip] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [terminalLocationId, setTerminalLocationId] = useState<string | null>(null);
  
  // Card element styling to match checkout form
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
  
  // Calculate final price with discount
  // Use totalPrice for multi-membership purchases, otherwise use unit price
  const originalPrice = packageData.totalPrice || packageData.price; // in cents
  let discountAmountCents = 0;
  
  if (discountData && discountData.value > 0) {
    if (discountData.type === 'percentage') {
      discountAmountCents = Math.round(originalPrice * (discountData.value / 100));
    } else {
      discountAmountCents = Math.round(discountData.value * 100); // convert dollars to cents
    }
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmountCents);

  // Track terminal instance in ref for cleanup
  const terminalRef = useRef<Terminal | null>(null);
  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track payment method to ensure we don't update state when switching to manual
  const paymentMethodRef = useRef(paymentMethod);
  
  // Keep paymentMethodRef in sync
  useEffect(() => {
    paymentMethodRef.current = paymentMethod;
  }, [paymentMethod]);
  
  // Fetch Terminal location for WisePOS E reader discovery
  useEffect(() => {
    if (paymentMethod === 'reader' && !terminalLocationId) {
      fetch('/api/stripe/terminal/location')
        .then(res => res.json())
        .then(data => {
          if (data.location?.id) {
            console.log('[Card Reader] Terminal location fetched:', data.location.id);
            setTerminalLocationId(data.location.id);
          }
        })
        .catch(err => console.error('[Card Reader] Failed to fetch terminal location:', err));
    }
  }, [paymentMethod, terminalLocationId]);
  
  // Function to connect to a specific reader
  const connectToReader = async (reader: any) => {
    if (!terminalRef.current) return;
    if (paymentMethodRef.current !== 'reader') return;
    
    setReaderStatus('connecting');
    setReaderMessage(`Connecting to ${reader.label || 'M2 Reader'}...`);
    
    try {
      const connectResult = await terminalRef.current.connectReader(reader);
      
      // Check if still mounted and in reader mode before updating state
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') return;
      
      if ('error' in connectResult) {
        setReaderStatus('error');
        setReaderMessage(`Failed to connect: ${connectResult.error.message || 'Unknown error'}`);
      } else {
        setConnectedReader(connectResult.reader);
        setReaderStatus('connected');
        setReaderMessage(`Connected to ${reader.label || 'M2 Card Reader'}`);
        setDiscoveredReaders([]);
      }
    } catch (error: any) {
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') return;
      setReaderStatus('error');
      setReaderMessage(error.message || 'Failed to connect to reader');
    }
  };
  
  // Function to retry discovery
  const retryDiscovery = async () => {
    // Only retry if still in reader mode
    if (paymentMethodRef.current !== 'reader') return;
    
    setConnectionAttempts(prev => prev + 1);
    setConnectedReader(null);
    setDiscoveredReaders([]);
    setShowTroubleshooting(false);
    await initializeTerminal();
  };
  
  // Initialize Stripe Terminal
  const initializeTerminal = async () => {
    // Don't initialize if not in reader mode
    if (paymentMethodRef.current !== 'reader') return;
    
    // Clean up existing terminal connection before reinitializing
    if (terminalRef.current) {
      try {
        await terminalRef.current.disconnectReader();
      } catch (e) {
        console.log('[Card Reader] Disconnect error (ok if no reader connected):', e);
      }
    }
    
    try {
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') {
        console.log('[Card Reader] Skipping init - component unmounted or payment method changed');
        return;
      }
      
      console.log('[Card Reader] Starting Terminal initialization...');
      setReaderStatus('initializing');
      setReaderMessage('Initializing Stripe Terminal...');
      setDiscoveredReaders([]);
      
      const stripeTerminal = await loadStripeTerminal();
      if (!stripeTerminal) {
        console.error('[Card Reader] Failed to load Stripe Terminal SDK');
        if (mountedRef.current && paymentMethodRef.current === 'reader') {
          setReaderStatus('error');
          setReaderMessage('Failed to load Stripe Terminal SDK');
        }
        return;
      }
      
      console.log('[Card Reader] Stripe Terminal SDK loaded successfully');
      
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') return;
      
      const term = stripeTerminal.create({
        onFetchConnectionToken: async () => {
          console.log('[Card Reader] Fetching connection token...');
          const response = await fetch('/api/stripe/terminal/connection-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await response.json();
          console.log('[Card Reader] Connection token received');
          return data.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          console.log('[Card Reader] Reader disconnected unexpectedly');
          if (mountedRef.current && paymentMethodRef.current === 'reader') {
            setReaderStatus('error');
            setReaderMessage('Card reader disconnected. Tap "Retry" to reconnect.');
            setConnectedReader(null);
          }
        },
      });
      
      console.log('[Card Reader] Terminal instance created');
      setTerminal(term);
      terminalRef.current = term;
      
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') return;
      
      // Don't auto-discover, show ready state with manual scan button
      setReaderStatus('ready');
      setReaderMessage('Terminal ready. Tap "Scan for Readers" to find your card reader.');
      console.log('[Card Reader] Ready for manual scan');
      
    } catch (error: any) {
      console.error('[Card Reader] Terminal initialization error:', error);
      if (mountedRef.current && paymentMethodRef.current === 'reader') {
        setReaderStatus('error');
        setReaderMessage(error.message || 'Card reader unavailable.');
        setShowTroubleshooting(true);
      }
    }
  };
  
  // Manual scan for readers - uses server-driven discovery (bypasses local network DNS issues)
  const scanForReaders = async () => {
    try {
      console.log('[Card Reader] Starting server-driven discovery for WisePOS E...');
      setReaderStatus('searching');
      setReaderMessage('Searching for card readers...');
      setDiscoveredReaders([]);
      setSelectedServerReader(null);
      
      // Use server-driven discovery - this queries Stripe API directly
      // and doesn't require local network connectivity to the reader
      const serverDiscovery = await fetch('/api/stripe/terminal/discover-readers');
      const serverResult = await serverDiscovery.json();
      
      console.log('[Card Reader] Server discovery result:', serverResult);
      
      if (!mountedRef.current || paymentMethodRef.current !== 'reader') return;
      
      if (serverResult.readers && serverResult.readers.length > 0) {
        console.log('[Card Reader] Found readers via server:', serverResult.readers.length);
        
        if (serverResult.locationId) {
          setTerminalLocationId(serverResult.locationId);
        }
        
        // Store discovered readers
        setDiscoveredReaders(serverResult.readers);
        
        // Auto-connect to the first reader
        const reader = serverResult.readers[0];
        console.log('[Card Reader] Auto-connecting to reader:', reader.label);
        setSelectedServerReader(reader);
        setReaderStatus('connected');
        setReaderMessage(`Connected to ${reader.label}`);
      } else {
        console.log('[Card Reader] No readers found on server');
        setReaderStatus('ready');
        setReaderMessage('No card readers found. Make sure your WisePOS E is registered in the Stripe Dashboard and powered on.');
        setShowTroubleshooting(true);
      }
    } catch (error: any) {
      console.error('[Card Reader] Scan error:', error);
      if (mountedRef.current && paymentMethodRef.current === 'reader') {
        setReaderStatus('ready');
        setReaderMessage(error.message || 'Scan failed. Try again.');
        setShowTroubleshooting(true);
      }
    }
  };
  
  // Select a reader from the discovered list (server-driven)
  const selectServerReader = (reader: any) => {
    console.log('[Card Reader] Selecting reader:', reader.label);
    setSelectedServerReader(reader);
    setReaderStatus('connected');
    setReaderMessage(`Connected to ${reader.label} (server-driven)`);
  };
  
  // Initialize card reader when reader mode is selected
  useEffect(() => {
    if (paymentMethod === 'reader' && !selectedServerReader) {
      // Use server-driven discovery (bypasses local network DNS issues with WisePOS E)
      scanForReaders();
    } else if (paymentMethod === 'manual') {
      // Reset reader state when switching to manual
      setReaderStatus('idle');
      setReaderMessage('');
      setDiscoveredReaders([]);
      setShowTroubleshooting(false);
      setSelectedServerReader(null);
    }
  }, [paymentMethod]);
  
  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Cleanup terminal on unmount
  useEffect(() => {
    return () => {
      if (terminalRef.current) {
        terminalRef.current.disconnectReader().catch(() => {});
      }
    };
  }, []);

  // Handle card reader payment - Server-driven approach (bypasses local network DNS issues)
  const handleReaderPayment = async () => {
    if (!selectedServerReader) {
      toast({
        title: "Reader Not Connected",
        description: "Please wait for the reader to connect or use manual entry.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setReaderStatus('processing');
    setReaderMessage('Creating payment...');

    let paymentIntentId: string | null = null;

    try {
      // Step 1: Create payment intent using existing kiosk endpoint with Terminal mode
      console.log('[Card Reader] Creating payment intent for server-driven flow...');
      const piResponse = await apiRequest(
        "POST",
        "/api/kiosk/create-member-payment",
        {
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
          useTerminal: true, // Use Terminal (card_present) payment method
          existingMemberId,
        },
      );
      
      const paymentData = await piResponse.json();
      const { paymentIntentId: piId, subscriptionId, customerId, isSubscription, stripePriceId } = paymentData;
      paymentIntentId = piId;
      
      if (!paymentIntentId) {
        throw new Error('Failed to create payment intent');
      }

      console.log('[Card Reader] Payment intent created:', paymentIntentId);

      // Step 2: Send payment to the reader via server API (server-driven)
      setReaderMessage('Please tap, insert, or swipe your card on the reader...');
      
      console.log('[Card Reader] Sending payment to reader:', selectedServerReader.id);
      const processResponse = await fetch('/api/stripe/terminal/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId: selectedServerReader.id,
          paymentIntentId,
        }),
      });
      
      const processResult = await processResponse.json();
      
      if (!processResponse.ok) {
        throw new Error(processResult.message || 'Failed to send payment to reader');
      }

      console.log('[Card Reader] Payment sent to reader, starting polling...');

      // Step 3: Poll for payment completion
      const maxPolls = 120; // 2 minutes (1 poll per second)
      let pollCount = 0;
      let paymentSucceeded = false;
      
      while (pollCount < maxPolls && !paymentSucceeded) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`/api/stripe/terminal/reader-status/${selectedServerReader.id}`);
        const statusResult = await statusResponse.json();
        
        console.log('[Card Reader] Poll', pollCount, 'status:', statusResult.action?.status);
        
        if (statusResult.action) {
          if (statusResult.action.status === 'succeeded') {
            paymentSucceeded = true;
            console.log('[Card Reader] Payment succeeded!');
          } else if (statusResult.action.status === 'failed') {
            throw new Error(statusResult.action.failure_message || 'Payment failed on reader');
          } else if (statusResult.action.status === 'in_progress') {
            // Still waiting for card
            if (pollCount % 10 === 0) {
              console.log('[Card Reader] Still waiting for card...');
            }
          }
        } else {
          // No action means it completed or was cleared
          // Check payment intent status directly
          const piStatusResponse = await fetch(`/api/stripe/payment-intent-status/${paymentIntentId}`);
          if (piStatusResponse.ok) {
            const piStatus = await piStatusResponse.json();
            if (piStatus.status === 'succeeded' || piStatus.status === 'requires_capture') {
              paymentSucceeded = true;
              console.log('[Card Reader] Payment intent succeeded!');
            }
          }
        }
        
        pollCount++;
      }

      if (!paymentSucceeded) {
        throw new Error('Payment timed out. Please try again.');
      }

      // Step 4: Confirm member creation
      setReaderMessage('Payment successful! Creating your account...');
      
      const confirmResponse = await apiRequest(
        "POST",
        "/api/kiosk/confirm-member-creation",
        {
          paymentIntentId,
          subscriptionId,
          customerId,
          isSubscription,
          stripePriceId,
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
          existingMemberId,
          additionalMembers: packageData.additionalMembers || [],
        },
      );

      if (confirmResponse.ok) {
        const additionalCount = packageData.additionalMembers?.length || 0;
        toast({
          title: "Payment Successful",
          description: additionalCount > 0 
            ? `Welcome! ${additionalCount + 1} memberships have been created successfully.`
            : `Welcome, ${memberData.firstName}! Your account has been created.`,
        });
        onSuccess();
      } else {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.message || 'Failed to create member account');
      }
    } catch (error: any) {
      console.error('[Card Reader] Server-driven payment error:', error);
      
      // Try to cancel any pending reader action
      if (selectedServerReader) {
        try {
          await fetch('/api/stripe/terminal/cancel-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ readerId: selectedServerReader.id }),
          });
        } catch (cancelError) {
          console.log('[Card Reader] Cancel action (ok if nothing to cancel):', cancelError);
        }
      }
      
      setReaderStatus('error');
      setReaderMessage(error.message || 'Payment failed. Please try again.');
      toast({
        title: "Payment Failed",
        description: error.message || 'Failed to process payment',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      // Reset to connected status after a short delay for error recovery
      setTimeout(() => {
        if (selectedServerReader) {
          setReaderStatus('connected');
          setReaderMessage(`Connected to ${selectedServerReader.label}`);
        }
      }, 2000);
    }
  };

  // Handle manual card payment (fallback)
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setCardError(null);
    
    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setIsProcessing(false);
      return;
    }

    try {
      const response = await apiRequest(
        "POST",
        "/api/kiosk/create-member-payment",
        {
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
          existingMemberId,
        },
      );
      const paymentData = await response.json();
      const { clientSecret, subscriptionId, customerId, isSubscription, stripePriceId } = paymentData;
      
      // Validate clientSecret before proceeding
      if (!clientSecret) {
        console.error('Payment creation failed - no clientSecret received:', paymentData);
        throw new Error(paymentData.message || 'Failed to create payment. Please try again.');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              name: `${memberData.firstName} ${memberData.lastName}`,
              email: memberData.email,
              phone: memberData.phoneNumber,
              address: {
                postal_code: billingZip,
              },
            },
          },
        },
      );

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        const confirmResponse = await apiRequest(
          "POST",
          "/api/kiosk/confirm-member-creation",
          {
            paymentIntentId: paymentIntent.id,
            subscriptionId,
            customerId,
            isSubscription,
            stripePriceId,
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
            existingMemberId,
            additionalMembers: packageData.additionalMembers || [],
          },
        );

        if (confirmResponse.ok) {
          const additionalCount = packageData.additionalMembers?.length || 0;
          toast({
            title: "Payment Successful",
            description: additionalCount > 0 
              ? `Welcome! ${additionalCount + 1} memberships have been created successfully.`
              : `Welcome, ${memberData.firstName}! Your account has been created.`,
          });
          onSuccess();
        } else {
          const errorData = await confirmResponse.json();
          toast({
            title: "Member Creation Failed",
            description: errorData.message || "Failed to create member account",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
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
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
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

      {/* Payment Method Selection */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={paymentMethod === 'reader' ? 'default' : 'outline'}
          onClick={() => setPaymentMethod('reader')}
          disabled={isProcessing}
          className="flex-1"
        >
          <Wifi className="h-4 w-4 mr-2" />
          Card Reader
        </Button>
        <Button
          type="button"
          variant={paymentMethod === 'manual' ? 'default' : 'outline'}
          onClick={() => setPaymentMethod('manual')}
          disabled={isProcessing}
          className="flex-1"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Manual Entry
        </Button>
      </div>

      {paymentMethod === 'reader' ? (
        <div className="space-y-6">
          {/* Card Reader Status */}
          <div className={`p-6 border-2 rounded-lg ${
            readerStatus === 'connected' ? 'border-green-500 bg-green-50' :
            readerStatus === 'processing' ? 'border-blue-500 bg-blue-50' :
            readerStatus === 'error' ? 'border-red-500 bg-red-50' :
            readerStatus === 'found' ? 'border-amber-500 bg-amber-50' :
            readerStatus === 'ready' ? 'border-blue-400 bg-blue-50' :
            readerStatus === 'searching' ? 'border-blue-300 bg-blue-50' :
            'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex justify-center mb-4">
              {(readerStatus === 'initializing' || readerStatus === 'connecting') && (
                <Loader2 className="h-12 w-12 text-gray-500 animate-spin" />
              )}
              {readerStatus === 'searching' && (
                <div className="relative">
                  <Wifi className="h-12 w-12 text-blue-600" />
                  <Radio className="h-6 w-6 text-blue-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
              )}
              {readerStatus === 'found' && (
                <Wifi className="h-12 w-12 text-amber-600" />
              )}
              {readerStatus === 'connected' && (
                <div className="relative">
                  <Wifi className="h-12 w-12 text-green-600" />
                  <CheckCircle className="h-5 w-5 text-green-600 absolute -bottom-1 -right-1 bg-green-50 rounded-full" />
                </div>
              )}
              {readerStatus === 'processing' && (
                <CreditCard className="h-12 w-12 text-blue-600 animate-pulse" />
              )}
              {readerStatus === 'error' && (
                <WifiOff className="h-12 w-12 text-red-600" />
              )}
              {readerStatus === 'idle' && (
                <Wifi className="h-12 w-12 text-gray-400" />
              )}
              {readerStatus === 'ready' && (
                <Wifi className="h-12 w-12 text-blue-600" />
              )}
            </div>
            <p className={`text-lg font-medium text-center ${
              readerStatus === 'connected' ? 'text-green-700' :
              readerStatus === 'processing' ? 'text-blue-700' :
              readerStatus === 'error' ? 'text-red-700' :
              readerStatus === 'found' ? 'text-amber-700' :
              readerStatus === 'searching' ? 'text-blue-600' :
              readerStatus === 'ready' ? 'text-blue-700' :
              'text-gray-600'
            }`}>
              {readerMessage || 'Initializing...'}
            </p>
            {readerStatus === 'processing' && (
              <p className="text-sm text-blue-600 mt-2 text-center">
                Please do not remove your card until prompted
              </p>
            )}
            
            {/* Reader Selection List */}
            {readerStatus === 'found' && discoveredReaders.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600 text-center mb-3">Tap a reader to connect:</p>
                {discoveredReaders.map((reader, index) => (
                  <Button
                    key={reader.id || index}
                    variant="outline"
                    className="w-full justify-start text-left py-4"
                    onClick={() => selectServerReader(reader)}
                  >
                    <Wifi className="h-5 w-5 mr-3 text-blue-600" />
                    <div>
                      <p className="font-medium">{reader.label || `Card Reader ${index + 1}`}</p>
                      <p className="text-xs text-gray-500">Serial: {reader.serial_number || 'Unknown'}</p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
            
            {/* Scan for Readers Button - shown when terminal is ready */}
            {readerStatus === 'ready' && (
              <div className="mt-4 space-y-3">
                <Button
                  variant="default"
                  className="w-full py-6 text-lg"
                  onClick={scanForReaders}
                >
                  <Wifi className="h-5 w-5 mr-2" />
                  Scan Network for Readers
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-gray-600"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  {showTroubleshooting ? 'Hide' : 'Show'} Troubleshooting Tips
                </Button>
              </div>
            )}
            
            {/* Error Actions - Retry and Troubleshooting */}
            {readerStatus === 'error' && (
              <div className="mt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={retryDiscovery}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Connection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-gray-600"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  {showTroubleshooting ? 'Hide' : 'Show'} Troubleshooting Tips
                </Button>
              </div>
            )}
            
            {/* Troubleshooting Tips */}
            {showTroubleshooting && (
              <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 text-left">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <HelpCircle className="h-4 w-4 mr-2 text-blue-600" />
                  Card Reader Setup Tips
                </h4>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li><strong>Power on the reader:</strong> Ensure your WisePOS E is powered on and showing the home screen</li>
                  <li><strong>Same WiFi network:</strong> The reader and this kiosk must be on the same WiFi network</li>
                  <li><strong>Check WiFi connection:</strong> On the reader, go to Settings → Network to verify WiFi is connected</li>
                  <li><strong>Register in Stripe Dashboard:</strong> New readers must be registered at dashboard.stripe.com/terminal/readers first</li>
                  <li><strong>Restart if needed:</strong> Try restarting the reader if it's not appearing</li>
                </ol>
                <p className="text-xs text-gray-500 mt-3 italic">
                  If issues persist, try restarting the card reader and refreshing this page.
                </p>
              </div>
            )}
            
            {/* Connection attempts indicator */}
            {connectionAttempts > 0 && readerStatus === 'error' && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Connection attempts: {connectionAttempts}
              </p>
            )}
          </div>

          <Button
            onClick={handleReaderPayment}
            disabled={isProcessing || readerStatus !== 'connected'}
            className="w-full text-lg py-6"
            data-testid="button-pay-reader"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${(finalPrice / 100).toFixed(2)} with Card Reader`
            )}
          </Button>
          
          {/* Quick switch to manual if reader has issues */}
          {(readerStatus === 'error' || readerStatus === 'searching') && (
            <p className="text-center text-sm text-gray-500">
              Having trouble? You can also use{' '}
              <button
                type="button"
                className="text-primary underline hover:text-primary/80"
                onClick={() => setPaymentMethod('manual')}
              >
                Manual Card Entry
              </button>
            </p>
          )}
        </div>
      ) : paymentMethod === 'manual' ? (
        <form onSubmit={handleManualPayment} className="space-y-6">
          <Card className="bg-white border-gray-200 shadow-lg">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl text-gray-900 flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Enter Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium text-gray-900 block">Card Number</Label>
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-medium text-gray-900 block">Expiry Date</Label>
                    <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                      <CardExpiryElement options={elementOptions} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-medium text-gray-900 block">CVC</Label>
                    <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                      <CardCvcElement options={elementOptions} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-medium text-gray-900 block">ZIP Code</Label>
                    <Input
                      type="text"
                      placeholder="12345"
                      value={billingZip}
                      onChange={(e) => setBillingZip(e.target.value)}
                      className="h-[58px] text-lg bg-gray-50 border-2 border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                      maxLength={10}
                      data-testid="input-billing-zip"
                    />
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
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="w-full text-lg py-6 bg-primary hover:bg-primary/90"
            size="lg"
            data-testid="button-pay"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5 mr-2" />
                Pay ${(finalPrice / 100).toFixed(2)}
              </>
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export interface ExistingMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

export default function KioskMemberCreation({
  onBack,
  onSuccess,
  existingMember,
  dayPassOnly = false,
}: {
  onBack: () => void;
  onSuccess: () => void;
  existingMember?: ExistingMember;
  dayPassOnly?: boolean;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "agreement" | "payment" | "success">("form");
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [agreementData, setAgreementData] = useState<AgreementFormData | null>(null);
  
  // Multi-membership purchase state
  const [membershipQuantity, setMembershipQuantity] = useState(1);
  const [additionalMembers, setAdditionalMembers] = useState<Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>>([]);

  // Fetch max memberships per purchase setting
  const { data: maxMembershipsData } = useQuery({
    queryKey: ["/api/settings/max-memberships"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/max-memberships");
      return await res.json();
    },
  });
  const maxMemberships = maxMembershipsData?.maxMemberships ?? 4;

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
      firstName: existingMember?.firstName || "",
      lastName: existingMember?.lastName || "",
      email: existingMember?.email || "",
      phoneNumber: existingMember?.phoneNumber || "",
      password: "",
      packageType: dayPassOnly ? "daypass" : "membership",
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

  // Handle quantity change for multi-membership purchases
  const handleQuantityChange = (newQuantity: number) => {
    setMembershipQuantity(newQuantity);
    // Adjust additional members array size
    const additionalCount = newQuantity - 1;
    if (additionalCount > additionalMembers.length) {
      // Add empty entries
      const newMembers = [...additionalMembers];
      for (let i = additionalMembers.length; i < additionalCount; i++) {
        newMembers.push({ firstName: '', lastName: '', email: '' });
      }
      setAdditionalMembers(newMembers);
    } else if (additionalCount < additionalMembers.length) {
      // Remove extra entries
      setAdditionalMembers(additionalMembers.slice(0, additionalCount));
    }
  };

  // Update additional member info
  const updateAdditionalMember = (index: number, field: 'firstName' | 'lastName' | 'email', value: string) => {
    const newMembers = [...additionalMembers];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setAdditionalMembers(newMembers);
  };

  // Validate additional members before proceeding
  const validateAdditionalMembers = (): boolean => {
    if (packageType !== 'membership' || membershipQuantity <= 1) return true;
    
    for (let i = 0; i < additionalMembers.length; i++) {
      const member = additionalMembers[i];
      if (!member.firstName.trim() || !member.lastName.trim() || !member.email.trim()) {
        toast({
          title: "Missing Information",
          description: `Please fill in all fields for additional member ${i + 2}`,
          variant: "destructive",
        });
        return false;
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
        toast({
          title: "Invalid Email",
          description: `Please enter a valid email for additional member ${i + 2}`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
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

    // Validate additional members for multi-membership purchases
    if (!validateAdditionalMembers()) {
      return;
    }

    const unitPrice = packageType === "membership"
      ? packageData.monthlyPrice
      : packageData.totalPrice;
    
    // Calculate total price based on quantity (only for memberships)
    const quantity = packageType === "membership" ? membershipQuantity : 1;
    const totalPrice = unitPrice * quantity;

    setSelectedPackage({
      ...packageData,
      type: packageType,
      price: unitPrice,
      totalPrice: totalPrice,
      quantity: quantity,
      additionalMembers: packageType === "membership" ? additionalMembers : [],
    });
    
    // Skip waiver for returning members - they already signed when they first joined
    if (existingMember) {
      // Set default agreement data for returning members (waiver already on file)
      setAgreementData({
        dateOfBirth: "", // Already on file from original signup
        emergencyContact: "", // Already on file from original signup
        emergencyPhone: "", // Already on file from original signup
        healthConfirmation: true,
        riskAcknowledgment: true,
        liabilityWaiver: true,
        rulesAcceptance: true,
        ageConfirmation: true,
      });
      setStep("payment");
    } else {
      setStep("agreement");
    }
  };

  const handleAgreementComplete = (data: AgreementFormData) => {
    setAgreementData(data);
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
                  discountData={null}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep("agreement")}
                  existingMemberId={existingMember?.id}
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

                  {!existingMember && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portal Password (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Set a password for portal login"
                              {...field}
                              className="text-lg py-3"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            If set, member can log in to the portal. Leave blank to set up later.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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
                                ? membershipPlans
                                    .filter((plan: any) => plan.isActive && plan.availableOnKiosk !== false)
                                    .map((plan: any) => (
                                    <SelectItem
                                      key={plan.id}
                                      value={plan.id.toString()}
                                    >
                                      {plan.name} - $
                                      {(plan.monthlyPrice / 100).toFixed(2)}
                                      /month
                                    </SelectItem>
                                  ))
                                : punchCardTemplates
                                    .filter((template: any) => template.isActive && template.availableOnKiosk !== false)
                                    .map((template: any) => (
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

                  {/* Quantity selector for memberships */}
                  {packageType === "membership" && packageId && !existingMember && (
                    <div className="space-y-4 border rounded-lg p-4 bg-blue-50/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">
                          Number of Memberships
                        </Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(Math.max(1, membershipQuantity - 1))}
                            disabled={membershipQuantity <= 1}
                          >
                            -
                          </Button>
                          <span className="text-xl font-bold w-8 text-center">{membershipQuantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(Math.min(maxMemberships, membershipQuantity + 1))}
                            disabled={membershipQuantity >= maxMemberships}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      {membershipQuantity > 1 && (
                        <p className="text-sm text-blue-700">
                          Purchasing {membershipQuantity} memberships (for family or as gifts)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Additional member forms */}
                  {packageType === "membership" && membershipQuantity > 1 && (
                    <div className="space-y-4">
                      <Separator />
                      <h4 className="font-semibold text-lg flex items-center">
                        <UserPlus className="h-5 w-5 mr-2" />
                        Additional Members
                      </h4>
                      <p className="text-sm text-gray-600">
                        Enter the details for each additional member. They will receive an email to set up their account.
                      </p>
                      {additionalMembers.map((member, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                          <h5 className="font-medium text-primary">
                            Member {index + 2} {index === 0 && membershipQuantity === 2 ? "(Family/Gift)" : ""}
                          </h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`add-first-${index}`}>First Name</Label>
                              <Input
                                id={`add-first-${index}`}
                                placeholder="First name"
                                value={member.firstName}
                                onChange={(e) => updateAdditionalMember(index, 'firstName', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`add-last-${index}`}>Last Name</Label>
                              <Input
                                id={`add-last-${index}`}
                                placeholder="Last name"
                                value={member.lastName}
                                onChange={(e) => updateAdditionalMember(index, 'lastName', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`add-email-${index}`}>Email Address</Label>
                            <Input
                              id={`add-email-${index}`}
                              type="email"
                              placeholder="email@example.com"
                              value={member.email}
                              onChange={(e) => updateAdditionalMember(index, 'email', e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
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
                              {packageType === "membership" && membershipQuantity > 1 && (
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                  × {membershipQuantity}
                                </span>
                              )}
                            </h3>
                            <p className="text-green-600 font-bold text-xl">
                              $
                              {packageType === "membership"
                                ? ((packageData.monthlyPrice * membershipQuantity) / 100).toFixed(2)
                                : (packageData.totalPrice / 100).toFixed(2)}
                              {packageType === "membership" && "/month"}
                            </p>
                            {packageType === "membership" && membershipQuantity > 1 && (
                              <p className="text-sm text-gray-500">
                                ${(packageData.monthlyPrice / 100).toFixed(2)} each × {membershipQuantity} members
                              </p>
                            )}
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
