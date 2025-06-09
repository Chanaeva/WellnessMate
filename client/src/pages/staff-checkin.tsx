import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, UserCheck, Clock, QrCode, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QRScanner } from "@/components/ui/qr-scanner";

export default function StaffCheckIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("scan");
  const { toast } = useToast();

  const processCheckIn = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/admin/manual-checkin", {
        membershipId: membershipId,
      });
      
      const result = await response.json();
      
      setLastCheckIn({
        member: result.member,
        timestamp: new Date(),
        membershipId: membershipId
      });
      
      toast({
        title: "Check-in Successful",
        description: `${result.member.username} has been checked in`,
      });
    } catch (error: any) {
      toast({
        title: "Check-in Failed",
        description: error.message || "Unable to check in member",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScan = (data: string) => {
    try {
      // Parse QR code data (JSON format)
      const qrData = JSON.parse(data);
      
      // Handle member daily check-in QR code
      if (qrData.type === "member_daily_checkin") {
        const today = new Date().toISOString().split('T')[0];
        
        // Verify QR code is for today
        if (qrData.date !== today) {
          toast({
            title: "Expired QR Code",
            description: "This QR code has expired. Please ask member to generate today's QR code.",
            variant: "destructive",
          });
          return;
        }
        
        // Process check-in directly with membership ID from QR code
        if (qrData.membershipId) {
          processCheckIn(qrData.membershipId);
        } else {
          toast({
            title: "Invalid QR Code",
            description: "QR code missing membership information",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Handle facility check-in QR code (admin generated)
      if (qrData.type === "facility_checkin") {
        const today = new Date().toISOString().split('T')[0];
        
        // Verify QR code is for today
        if (qrData.date !== today) {
          toast({
            title: "Expired QR Code",
            description: "This facility QR code has expired. Please use today's QR code.",
            variant: "destructive",
          });
          return;
        }
        
        // For facility QR codes, prompt for membership ID
        const membershipId = prompt("Please enter the member's Membership ID (e.g., WM-001):");
        if (membershipId && membershipId.trim()) {
          processCheckIn(membershipId.trim());
        } else {
          toast({
            title: "Membership ID Required",
            description: "Please enter a valid membership ID for check-in",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Handle legacy individual member QR code
      if (qrData.membershipId) {
        processCheckIn(qrData.membershipId);
      } else {
        throw new Error("Invalid QR code format");
      }
    } catch (error) {
      // If not JSON, treat as plain membership ID
      if (data && data.trim()) {
        processCheckIn(data.trim());
      } else {
        toast({
          title: "Invalid QR Code",
          description: "Unable to read the QR code data",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Staff Check-in</h1>
          <p className="text-slate-600">Wolf Mother Wellness Front Desk</p>
        </div>

        {/* QR Code Check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Staff-Assisted Member Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Scan QR Code
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Scan className="h-4 w-4" />
                  Backup Entry
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="scan" className="mt-6">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Ask the member to show their QR code from the Wolf Mother app, then scan it below:
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Processing check-in...</p>
                      </div>
                    ) : (
                      <QRScanner onScan={handleQRScan} />
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="mt-6">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Use this backup method only if QR scanning is not available:
                  </p>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Manual entry is temporarily disabled. Please use QR code scanning for member check-ins.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Last Check-in Display */}
            {lastCheckIn && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Check-in Successful</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Member:</strong> {lastCheckIn.member.username}</p>
                  <p><strong>Email:</strong> {lastCheckIn.member.email}</p>
                  <p><strong>Membership ID:</strong> {lastCheckIn.membershipId}</p>
                  <p><strong>Time:</strong> {lastCheckIn.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">QR Code Check-in Process:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Ask the member to open the Wolf Mother app</li>
                <li>• Have them show their QR code on their phone screen</li>
                <li>• Use the scanner above to scan their QR code</li>
                <li>• A confirmation will appear when successful</li>
              </ul>
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-green-700">
                  <strong>Benefits:</strong> Faster, touchless, and automatically logs visit data
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-gray-600" />
                <div className="text-sm font-medium text-gray-700">Current Time</div>
                <div className="text-lg font-bold text-gray-900">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <UserCheck className="h-4 w-4 mx-auto mb-1 text-gray-600" />
                <div className="text-sm font-medium text-gray-700">Check-in Method</div>
                <Badge variant="secondary" className="text-xs">Manual</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="text-center">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Return to Main Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}