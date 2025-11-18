import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";
import { 
  QrCode, 
  CheckCircle, 
  Camera, 
  Sparkles, 
  User, 
  Clock,
  ArrowLeft,
  Waves,
  UserPlus
} from "lucide-react";
import KioskMemberCreation from "./kiosk-member-creation";

interface CheckInResponse {
  success?: boolean;
  requiresConfirmation?: boolean;
  member?: {
    firstName: string;
    lastName: string;
    membershipType?: string;
    membershipStatus?: string;
  };
  dayPasses?: {
    available: boolean;
    totalRemaining: number;
    packages: Array<{
      id: number;
      name: string;
      remaining: number;
      total: number;
    }>;
  };
  dayPassInfo?: {
    used: boolean;
    totalRemaining: number;
    packages: Array<{
      id: number;
      name: string;
      remaining: number;
      total: number;
    }>;
  };
  message: string;
}

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

export default function KioskCheckIn() {
  const [scannerMode, setScannerMode] = useState<'waiting' | 'scanning' | 'manual-entry' | 'confirmation' | 'success' | 'error' | 'create-member' | 'buy-drop-in'>('waiting');
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);
  const [manualSearchTerm, setManualSearchTerm] = useState("");
  const { toast } = useToast();
  const scannerRef = useRef<HTMLDivElement>(null);
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual search query for email/membership ID lookup
  const { data: manualSearchResults } = useQuery({
    queryKey: ['/api/kiosk/search-member', manualSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/search-member?query=${encodeURIComponent(manualSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Member not found');
      return await res.json();
    },
    enabled: manualSearchTerm.length >= 3 && scannerMode === 'manual-entry',
    retry: false,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ membershipId, useDayPass }: { membershipId: string; useDayPass?: boolean }) => {
      const res = await apiRequest("POST", "/api/kiosk-check-in", { membershipId, useDayPass });
      return await res.json() as CheckInResponse;
    },
    onSuccess: (data) => {
      setScanResult(data);
      
      if (data.requiresConfirmation) {
        setScannerMode('confirmation');
        // Don't auto-reset on confirmation
      } else if (data.success) {
        setScannerMode('success');
        queryClient.invalidateQueries({ queryKey: ["/api/check-ins"] });
        
        // Auto-resume scanning after 5 seconds
        autoResumeTimerRef.current = setTimeout(() => {
          resetAndResume();
        }, 5000);
      } else {
        setScannerMode('error');
        
        // Auto-resume scanning after 4 seconds on error
        autoResumeTimerRef.current = setTimeout(() => {
          resetAndResume();
        }, 4000);
      }
    },
    onError: (error: any) => {
      setScanResult({
        success: false,
        message: error.message || "Failed to process check-in"
      });
      setScannerMode('error');
      
      // Auto-resume scanning after 4 seconds on error
      autoResumeTimerRef.current = setTimeout(() => {
        resetAndResume();
      }, 4000);
    },
  });

  const confirmCheckIn = (useDayPass: boolean) => {
    if (pendingMembershipId) {
      checkInMutation.mutate({ membershipId: pendingMembershipId, useDayPass });
    }
  };

  const initializeScanner = () => {
    if (scannerRef.current && !scanner) {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-scanner",
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
        },
        false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          // QR code successfully scanned
          html5QrcodeScanner.clear();
          setScanner(null);
          
          // Extract membership ID from QR code data
          let membershipId = decodedText;
          if (decodedText.includes('membership:')) {
            membershipId = decodedText.split('membership:')[1];
          }
          
          setPendingMembershipId(membershipId);
          checkInMutation.mutate({ membershipId });
        },
        (error) => {
          // Scanning failed or no QR code found - this is normal, don't show error
          console.log("Scanning...", error);
        }
      );

      setScanner(html5QrcodeScanner);
      setScannerMode('scanning');
    }
  };

  const resetScanner = () => {
    // Clear any auto-resume timers
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
      autoResumeTimerRef.current = null;
    }
    
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScannerMode('waiting');
    setScanResult(null);
    setPendingMembershipId(null);
    setManualSearchTerm("");
  };

  const resetAndResume = () => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScanResult(null);
    setPendingMembershipId(null);
    setManualSearchTerm("");
    
    // Auto-start scanner again
    setScannerMode('waiting');
    setTimeout(() => {
      initializeScanner();
    }, 500);
  };

  // Cleanup scanner and timers on component unmount
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
      }
    };
  }, [scanner]);

  // Show member creation form
  if (scannerMode === 'create-member') {
    return (
      <KioskMemberCreation
        onBack={() => setScannerMode('waiting')}
        onSuccess={() => setScannerMode('waiting')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src={logoMossGreen} 
              alt="Wolf Mother Wellness" 
              className="h-20 w-20 drop-shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
            Wolf Mother Wellness
          </h1>
          <p className="text-xl text-muted-foreground">
            Member Check-In Kiosk
          </p>
        </div>

        {/* Main Content */}
        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              {scannerMode === 'waiting' && <QrCode className="h-16 w-16 text-primary" />}
              {scannerMode === 'scanning' && <Camera className="h-16 w-16 text-primary animate-pulse" />}
              {scannerMode === 'manual-entry' && <User className="h-16 w-16 text-primary" />}
              {scannerMode === 'confirmation' && <User className="h-16 w-16 text-blue-500" />}
              {scannerMode === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
              {scannerMode === 'error' && <User className="h-16 w-16 text-red-500" />}
              {scannerMode === 'buy-drop-in' && <Sparkles className="h-16 w-16 text-green-600" />}
            </div>
            <CardTitle className="text-3xl font-heading font-bold">
              {scannerMode === 'waiting' && 'Ready to Check In'}
              {scannerMode === 'scanning' && 'Scanning QR Code...'}
              {scannerMode === 'manual-entry' && 'Manual Check-In'}
              {scannerMode === 'confirmation' && 'Choose Check-In Method'}
              {scannerMode === 'success' && 'Welcome Back!'}
              {scannerMode === 'error' && 'Check-In Issue'}
              {scannerMode === 'buy-drop-in' && 'Purchase Day Pass'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Waiting State */}
            {scannerMode === 'waiting' && (
              <div className="text-center space-y-6">
                <p className="text-xl text-muted-foreground mb-8">
                  Tap the button below to start scanning your QR code
                </p>
                <Button 
                  size="lg" 
                  onClick={initializeScanner}
                  className="bg-primary hover:bg-primary/90 text-white px-12 py-6 text-2xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                  data-testid="button-scan-qr"
                >
                  <QrCode className="h-8 w-8 mr-4" />
                  Check In with QR Code
                </Button>
                
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">or</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => setScannerMode('manual-entry')}
                  variant="outline"
                  size="lg"
                  className="w-full border-2 text-lg font-semibold py-4"
                  data-testid="button-manual-entry"
                >
                  <User className="h-5 w-5 mr-3" />
                  Enter Email or Membership ID
                </Button>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Button 
                    onClick={() => setScannerMode('create-member')}
                    variant="outline"
                    size="lg"
                    className="border-2 border-primary text-primary hover:bg-primary/10 text-base font-semibold py-3"
                    data-testid="button-create-member"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    New Member
                  </Button>
                  
                  <Button 
                    onClick={() => setScannerMode('create-member')}
                    variant="outline"
                    size="lg"
                    className="border-2 border-green-600 text-green-600 hover:bg-green-50 text-base font-semibold py-3"
                    data-testid="button-buy-drop-in"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Buy Day Pass
                  </Button>
                </div>
                
                <div className="flex items-center justify-center text-sm text-muted-foreground mt-8">
                  <Waves className="h-4 w-4 mr-2" />
                  <span>Sacred waters await your arrival</span>
                </div>
              </div>
            )}

            {/* Scanning State */}
            {scannerMode === 'scanning' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-lg text-muted-foreground">
                    Hold your phone's QR code up to the camera
                  </p>
                </div>
                
                <div 
                  id="qr-scanner" 
                  ref={scannerRef}
                  className="border-2 border-dashed border-primary/30 rounded-xl overflow-hidden"
                ></div>
                
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={resetScanner}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Manual Entry State */}
            {scannerMode === 'manual-entry' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-lg text-muted-foreground">
                    Enter your email address or membership ID
                  </p>
                </div>
                
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="email@example.com or membership ID"
                    value={manualSearchTerm}
                    onChange={(e) => setManualSearchTerm(e.target.value)}
                    className="text-lg py-6"
                    data-testid="input-manual-search"
                    autoFocus
                  />
                  
                  {manualSearchResults && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-bold text-green-800">
                            {manualSearchResults.firstName} {manualSearchResults.lastName}
                          </h3>
                          <p className="text-sm text-green-600">{manualSearchResults.email}</p>
                        </div>
                        <Button
                          onClick={() => {
                            setPendingMembershipId(manualSearchResults.membershipId);
                            checkInMutation.mutate({ membershipId: manualSearchResults.membershipId });
                          }}
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={checkInMutation.isPending}
                          data-testid="button-confirm-manual-checkin"
                        >
                          {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  
                  {manualSearchTerm.length >= 3 && !manualSearchResults && (
                    <p className="text-center text-sm text-muted-foreground">
                      Member not found. Please check your email or membership ID.
                    </p>
                  )}
                </div>
                
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={resetScanner}
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmation State */}
            {scannerMode === 'confirmation' && scanResult && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                    <h3 className="text-xl font-bold text-blue-800 mb-2">
                      Hi {scanResult.member?.firstName}!
                    </h3>
                    <p className="text-blue-700 mb-4">
                      {scanResult.message}
                    </p>
                    
                    {scanResult.dayPasses && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="font-semibold text-blue-800 mb-2">Day Passes Available:</p>
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          {scanResult.dayPasses.totalRemaining} days remaining
                        </div>
                        <div className="space-y-1 text-sm text-blue-600">
                          {scanResult.dayPasses.packages.map(pkg => (
                            <div key={pkg.id} className="flex justify-between">
                              <span>{pkg.name}</span>
                              <span>{pkg.remaining}/{pkg.total} remaining</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {(scanResult.member?.membershipStatus === 'active') && (
                      <Button 
                        size="lg"
                        onClick={() => confirmCheckIn(false)}
                        className="bg-primary hover:bg-primary/90 text-white py-6 text-xl font-bold"
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full mr-3" />
                        ) : (
                          <User className="h-6 w-6 mr-3" />
                        )}
                        Use Monthly Membership
                      </Button>
                    )}
                    
                    {scanResult.dayPasses && scanResult.dayPasses.totalRemaining > 0 && (
                      <Button 
                        size="lg"
                        variant="outline"
                        onClick={() => confirmCheckIn(true)}
                        className="border-2 border-primary text-primary hover:bg-primary/10 py-6 text-xl font-bold"
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full mr-3" />
                        ) : (
                          <Sparkles className="h-6 w-6 mr-3" />
                        )}
                        Use Day Pass ({scanResult.dayPasses.totalRemaining} left)
                      </Button>
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    onClick={resetScanner}
                    className="mt-4 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Success State */}
            {scannerMode === 'success' && scanResult?.success && (
              <div className="text-center space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <h3 className="text-2xl font-bold text-green-800 mb-2">
                    Welcome back, {scanResult.member?.firstName}!
                  </h3>
                  <div className="flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-green-600 mr-2" />
                    <span className="text-lg text-green-700">Enjoy your session</span>
                    <Sparkles className="h-6 w-6 text-green-600 ml-2" />
                  </div>
                  
                  {scanResult.member?.membershipType && (
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-base px-4 py-1 mb-4">
                      {scanResult.member.membershipType} Check-in
                    </Badge>
                  )}

                  {/* Show day pass info if used */}
                  {scanResult.dayPassInfo?.used && (
                    <div className="bg-white rounded-lg p-4 border border-green-200 mt-4">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="font-semibold text-green-800">Day Pass Used</span>
                      </div>
                      <div className="text-lg font-bold text-green-700 mb-2">
                        {scanResult.dayPassInfo.totalRemaining} days remaining
                      </div>
                      <div className="space-y-1 text-sm text-green-600">
                        {scanResult.dayPassInfo.packages.map(pkg => (
                          <div key={pkg.id} className="flex justify-between">
                            <span>{pkg.name}</span>
                            <span>{pkg.remaining}/{pkg.total} left</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>Checked in at {new Date().toLocaleTimeString()}</span>
                </div>
                
                <p className="text-muted-foreground">
                  You may now proceed to the changing area
                </p>
              </div>
            )}

            {/* Error State */}
            {scannerMode === 'error' && (
              <div className="text-center space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-red-800 mb-2">
                    Unable to Check In
                  </h3>
                  <p className="text-red-700">
                    {scanResult?.message || "Please try scanning your QR code again or see staff for assistance."}
                  </p>
                </div>
                
                <Button 
                  onClick={resetScanner}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-3"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Need help? Please see our staff at the front desk</p>
        </div>
      </div>
    </div>
  );
}