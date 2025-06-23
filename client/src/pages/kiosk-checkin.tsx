import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";
import { 
  QrCode, 
  CheckCircle, 
  Camera, 
  Sparkles, 
  User, 
  Clock,
  ArrowLeft,
  Waves
} from "lucide-react";

interface CheckInResponse {
  success: boolean;
  member?: {
    firstName: string;
    lastName: string;
    membershipType?: string;
    membershipStatus?: string;
  };
  message: string;
}

export default function KioskCheckIn() {
  const [scannerMode, setScannerMode] = useState<'waiting' | 'scanning' | 'success' | 'error'>('waiting');
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();
  const scannerRef = useRef<HTMLDivElement>(null);

  const checkInMutation = useMutation({
    mutationFn: async (qrData: string) => {
      // Extract membership ID from QR code data
      let membershipId = qrData;
      if (qrData.includes('membership:')) {
        membershipId = qrData.split('membership:')[1];
      }
      
      const res = await apiRequest("POST", "/api/check-in", { membershipId });
      return await res.json() as CheckInResponse;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setScannerMode(data.success ? 'success' : 'error');
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins"] });
      
      // Auto-reset after 5 seconds
      setTimeout(() => {
        resetScanner();
      }, 5000);
    },
    onError: (error: any) => {
      setScanResult({
        success: false,
        message: error.message || "Failed to process check-in"
      });
      setScannerMode('error');
      
      // Auto-reset after 3 seconds on error
      setTimeout(() => {
        resetScanner();
      }, 3000);
    },
  });

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
          checkInMutation.mutate(decodedText);
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
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScannerMode('waiting');
    setScanResult(null);
  };

  // Cleanup scanner on component unmount
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanner]);

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
              {scannerMode === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
              {scannerMode === 'error' && <User className="h-16 w-16 text-red-500" />}
            </div>
            <CardTitle className="text-3xl font-heading font-bold">
              {scannerMode === 'waiting' && 'Ready to Check In'}
              {scannerMode === 'scanning' && 'Scanning QR Code...'}
              {scannerMode === 'success' && 'Welcome Back!'}
              {scannerMode === 'error' && 'Check-In Issue'}
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
                >
                  <QrCode className="h-8 w-8 mr-4" />
                  Check In
                </Button>
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
                    <Badge className="bg-green-100 text-green-800 border-green-300 text-base px-4 py-1">
                      {scanResult.member.membershipType} Member
                    </Badge>
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