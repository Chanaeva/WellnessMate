import { useEffect, useState } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Membership, CheckIn } from "@shared/schema";
import { QRCode } from "@/components/ui/qr-code";
import { QRScanner } from "@/components/ui/qr-scanner";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  Mail, 
  Smartphone, 
  Scan, 
  CheckCircle, 
  CalendarDays, 
  Clock 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function QRCodePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("view");

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
        location: "Main Entrance" 
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
      // In a real app, this would validate the QR code data
      // For now, we'll assume the scanned data is the membership ID
      if (data && membership?.membershipId) {
        checkInMutation.mutate(membership.membershipId);
      } else {
        toast({
          title: "Invalid QR code",
          description: "The scanned QR code is not valid.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error processing QR code",
        description: "Unable to process the scanned QR code.",
        variant: "destructive",
      });
    }
  };

  // Generate QR code data
  const qrCodeData = membership ? JSON.stringify({
    membershipId: membership.membershipId,
    userId: user?.id,
    timestamp: new Date().toISOString(),
  }) : '';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Your Member QR Code</CardTitle>
              <CardDescription>Use this code to check in at our facility</CardDescription>
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
                      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm inline-block mb-4">
                        <QRCode 
                          value={qrCodeData} 
                          size={250} 
                          level="H"
                          className="mx-auto"
                        />
                      </div>

                      <div className="text-center mb-6">
                        <p className="text-sm text-gray-500">Member ID: <span className="font-semibold">{membership.membershipId}</span></p>
                        <p className="text-sm text-gray-500">{user?.firstName} {user?.lastName}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                        <Button className="bg-primary hover:bg-primary/90 flex items-center justify-center">
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                        <Button variant="outline" className="bg-neutral-light hover:bg-gray-200 flex items-center justify-center">
                          <Mail className="mr-2 h-4 w-4" /> Email Code
                        </Button>
                      </div>
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
                    width={300}
                    height={300}
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

              <div className="mt-10 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold mb-3">How to use your QR code</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4">
                    <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-medium text-sm">Step 1</h4>
                    <p className="text-sm text-gray-600 mt-1">Have your QR code ready on your device or printed</p>
                  </div>
                  <div className="p-4">
                    <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Scan className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-medium text-sm">Step 2</h4>
                    <p className="text-sm text-gray-600 mt-1">Visit the check-in kiosk at the entrance</p>
                  </div>
                  <div className="p-4">
                    <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-medium text-sm">Step 3</h4>
                    <p className="text-sm text-gray-600 mt-1">Scan your code and enjoy your visit</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Recent Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              {isCheckInsLoading ? (
                <div className="p-4 text-center">Loading check-in history...</div>
              ) : checkIns && checkIns.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
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
                            {format(new Date(checkIn.timestamp), "MMM dd, yyyy")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(checkIn.timestamp), "h:mm a")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {checkIn.location}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
