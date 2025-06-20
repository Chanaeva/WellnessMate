import { useEffect, useState, useRef } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { Membership, CheckIn } from "@shared/schema";
import { QRCode } from "@/components/ui/qr-code";
import { QRScanner } from "@/components/ui/qr-scanner";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Mail, 
  Smartphone, 
  Scan, 
  CheckCircle, 
  CalendarDays, 
  Clock,
  Maximize2,
  Share2,
  Vibrate,
  WifiOff,
  ArrowLeft,
  Copy
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function QRCodePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("view");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Check for offline capability
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setIsOfflineMode(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Mobile helper functions
  const toggleFullscreen = () => {
    if (!isFullscreen && qrCodeRef.current) {
      if (qrCodeRef.current.requestFullscreen) {
        qrCodeRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const increaseBrightness = () => {
    setBrightness(prev => Math.min(prev + 0.2, 2));
  };

  const shareQRCode = async () => {
    if (navigator.share && qrCodeData) {
      try {
        await navigator.share({
          title: 'Wolf Mother Wellness QR Code',
          text: 'My Wolf Mother Wellness check-in QR code',
          url: window.location.href
        });
      } catch (error) {
        // Fallback to copy
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (qrCodeData) {
      navigator.clipboard.writeText(qrCodeData).then(() => {
        toast({
          title: "Copied to clipboard",
          description: "QR code data copied successfully",
          variant: "default",
        });
      });
    }
  };

  const addToWallet = () => {
    // This would integrate with Apple Wallet or Google Pay in a real app
    toast({
      title: "Add to Wallet",
      description: "Feature coming soon - save QR code to your device for now",
      variant: "default",
    });
  };

  // Fetch membership data
  const { data: membership } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch check-ins data
  const { data: checkIns, isLoading: isCheckInsLoading } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins"],
    enabled: !!user,
  });

  // QR code check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      return await apiRequest("POST", "/api/check-in", { 
        userId: user?.id,
        membershipId,
        location: "Thermal Wellness Center Entrance" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins"] });
      toast({
        title: "Check-in successful!",
        description: "Your check-in has been recorded.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle QR code scan
  const handleScan = (data: string) => {
    try {
      // Parse the QR code data
      const qrData = JSON.parse(data);
      
      if (qrData.membershipId) {
        checkInMutation.mutate(qrData.membershipId);
      } else {
        toast({
          title: "Invalid QR code",
          description: "The scanned QR code is not valid.",
          variant: "destructive",
        });
      }
    } catch (error) {
      // If it's not JSON, treat it as a plain membership ID
      if (data && data.trim()) {
        checkInMutation.mutate(data.trim());
      } else {
        toast({
          title: "Error processing QR code",
          description: "Unable to process the scanned QR code.",
          variant: "destructive",
        });
      }
    }
  };

  // Generate daily QR code data with today's date
  const qrCodeData = membership ? JSON.stringify({
    type: "member_daily_checkin",
    membershipId: membership.membershipId,
    userId: user?.id,
    date: format(new Date(), "yyyy-MM-dd"),
    facility: "wolf_mother_wellness",
    memberName: `${user?.firstName} ${user?.lastName}`,
  }) : '';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      {!isFullscreen && <Header />}
      
      {/* Offline indicator */}
      {isOfflineMode && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 text-sm">
          <div className="flex items-center">
            <WifiOff className="h-4 w-4 mr-2" />
            <span>You're offline. Your QR code is still available for check-in.</span>
          </div>
        </div>
      )}
      
      <main className={`flex-grow ${isFullscreen ? 'p-0' : 'container mx-auto px-4 py-8'}`}>
        <div className={isFullscreen ? 'h-screen flex items-center justify-center bg-white' : 'max-w-2xl mx-auto'}>
          {isFullscreen ? (
            // Fullscreen QR Code View
            <div ref={qrCodeRef} className="flex flex-col items-center justify-center h-full w-full bg-white relative" style={{ filter: `brightness(${brightness})` }}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-4 left-4 z-10"
                onClick={toggleFullscreen}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Wolf Mother</h1>
                <p className="text-gray-600">Ready to check in</p>
                {membership && (
                  <Badge variant="secondary" className="mt-2">
                    {membership.membershipId}
                  </Badge>
                )}
              </div>

              <div className="bg-white p-8 border-4 border-gray-100 rounded-2xl shadow-lg">
                <QRCode 
                  value={qrCodeData} 
                  size={isMobile ? 280 : 350} 
                  level="H"
                  className="mx-auto"
                />
              </div>

              <div className="mt-8 flex space-x-4">
                <Button variant="outline" size="sm" onClick={increaseBrightness}>
                  Brighter
                </Button>
                <Button variant="outline" size="sm" onClick={shareQRCode}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Regular View */}
              <Card className="mb-6">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold">Your Daily Check-in QR Code</CardTitle>
                  <CardDescription>
                    Valid for {format(new Date(), "MMMM dd, yyyy")} - Automatically updates daily
                  </CardDescription>
                  {isOfflineMode && (
                    <Badge variant="secondary" className="mt-2">
                      Available Offline
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="view" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="view">View QR Code</TabsTrigger>
                      <TabsTrigger value="scan">Scan QR Code</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="view" className="flex flex-col items-center">
                      {membership ? (
                        <>
                          <div ref={qrCodeRef} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm inline-block mb-4" style={{ filter: `brightness(${brightness})` }}>
                            <QRCode 
                              value={qrCodeData} 
                              size={isMobile ? 220 : 250} 
                              level="H"
                              className="mx-auto"
                            />
                          </div>

                          <div className="text-center mb-6">
                            <p className="text-sm text-gray-500">Member ID: <span className="font-semibold">{membership.membershipId}</span></p>
                            <p className="text-sm text-gray-500">{user?.firstName} {user?.lastName}</p>
                            <Badge 
                              variant={membership.status === 'active' ? 'default' : 'secondary'} 
                              className="mt-2"
                            >
                              {membership.status}
                            </Badge>
                          </div>

                          {/* Mobile-optimized action buttons */}
                          <div className={`grid gap-3 w-full max-w-md ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {isMobile && (
                              <Button 
                                className="bg-primary hover:bg-primary/90 flex items-center justify-center py-3"
                                onClick={toggleFullscreen}
                              >
                                <Maximize2 className="mr-2 h-4 w-4" /> 
                                Fullscreen for Check-in
                              </Button>
                            )}
                            
                            <Button 
                              variant="outline" 
                              className="bg-neutral-light hover:bg-gray-200 flex items-center justify-center"
                              onClick={shareQRCode}
                            >
                              <Share2 className="mr-2 h-4 w-4" /> 
                              {isMobile ? 'Share' : 'Share Code'}
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              className="bg-neutral-light hover:bg-gray-200 flex items-center justify-center"
                              onClick={copyToClipboard}
                            >
                              <Copy className="mr-2 h-4 w-4" /> 
                              Copy
                            </Button>
                            
                            {!isMobile && (
                              <>
                                <Button 
                                  variant="outline" 
                                  className="bg-neutral-light hover:bg-gray-200 flex items-center justify-center"
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="bg-neutral-light hover:bg-gray-200 flex items-center justify-center"
                                >
                                  <Mail className="mr-2 h-4 w-4" /> Email Code
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Mobile quick tips */}
                          {isMobile && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                              <h4 className="font-medium text-blue-900 mb-2">Quick Check-in Tips</h4>
                              <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Tap "Fullscreen" for easier scanning</li>
                                <li>• Keep screen brightness high</li>
                                <li>• Works offline - no internet needed</li>
                                <li>• Save to home screen for quick access</li>
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-8">
                          <p className="text-gray-500">No active membership found. Please contact staff to activate your membership.</p>
                        </div>
                      )}
                    </TabsContent>
                  
                    <TabsContent value="scan">
                      <div className="text-center mb-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Scan the QR code at the entrance to check in
                        </p>
                      </div>
                      
                      <QRScanner 
                        onScan={handleScan}
                        onError={(error) => {
                          toast({
                            title: "Scanner Error",
                            description: error,
                            variant: "destructive",
                          });
                        }}
                        width={isMobile ? 280 : 300}
                        height={isMobile ? 280 : 300}
                      />
                      
                      {checkInMutation.isPending && (
                        <div className="text-center mt-4 p-3 bg-primary/10 rounded-md">
                          <p className="text-primary">Processing check-in...</p>
                        </div>
                      )}
                      
                      {checkInMutation.isSuccess && (
                        <div className="text-center mt-4 p-3 bg-green-100 rounded-md flex items-center justify-center">
                          <CheckCircle className="text-green-600 mr-2 h-5 w-5" />
                          <p className="text-green-600">Successfully checked in!</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* How to use section - mobile optimized */}
                  <div className="mt-10 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-bold mb-3">How to use your QR code</h3>
                    <div className={`grid gap-4 text-center ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      <div className="p-4">
                        <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-medium text-sm">Step 1</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {isMobile ? 'Open fullscreen mode for easier scanning' : 'Have your QR code ready on your device or printed'}
                        </p>
                      </div>
                      <div className="p-4">
                        <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Scan className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-medium text-sm">Step 2</h4>
                        <p className="text-sm text-gray-600 mt-1">Visit the check-in station at the thermal center entrance</p>
                      </div>
                      <div className="p-4">
                        <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-medium text-sm">Step 3</h4>
                        <p className="text-sm text-gray-600 mt-1">Scan your code and enjoy your thermal wellness experience</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Recent Check-ins - hide in fullscreen */}
          {!isFullscreen && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Recent Check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                {isCheckInsLoading ? (
                  <div className="p-4 text-center">Loading check-in history...</div>
                ) : checkIns && checkIns.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    {isMobile ? (
                      // Mobile-friendly list view
                      <div className="divide-y divide-gray-200">
                        {checkIns.slice(0, 5).map((checkIn) => (
                          <div key={checkIn.id} className="p-4 flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">
                                {checkIn.timestamp ? format(new Date(checkIn.timestamp), "MMM dd, yyyy") : 'N/A'}
                              </p>
                              <p className="text-xs text-gray-500">{checkIn.location}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {checkIn.timestamp ? format(new Date(checkIn.timestamp), "h:mm a") : 'N/A'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Desktop table view
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {checkIns.slice(0, 5).map((checkIn, index) => (
                            <tr key={checkIn.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {checkIn.timestamp ? format(new Date(checkIn.timestamp), "MMM dd, yyyy") : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {checkIn.timestamp ? format(new Date(checkIn.timestamp), "h:mm a") : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {checkIn.location}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No check-ins yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Your check-in history will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      {!isFullscreen && <Footer />}
    </div>
  );
}
