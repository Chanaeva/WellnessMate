import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, UserCheck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function StaffCheckIn() {
  const [membershipId, setMembershipId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const { toast } = useToast();

  const handleManualCheckIn = async () => {
    if (!membershipId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a membership ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/admin/manual-checkin", {
        membershipId: membershipId.trim(),
      });
      
      const result = await response.json();
      
      setLastCheckIn({
        member: result.member,
        timestamp: new Date(),
        membershipId: membershipId.trim()
      });
      
      toast({
        title: "Check-in Successful",
        description: `${result.member.username} has been checked in`,
      });
      
      setMembershipId("");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Staff Check-in</h1>
          <p className="text-slate-600">Wolf Mother Wellness Front Desk</p>
        </div>

        {/* Manual Check-in Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Manual Member Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Membership ID
                </label>
                <Input
                  placeholder="Enter member's ID (e.g., WM-12345)"
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !isLoading && handleManualCheckIn()}
                  className="text-lg py-3"
                  disabled={isLoading}
                />
              </div>
              
              <Button 
                onClick={handleManualCheckIn}
                className="w-full py-3 text-lg"
                disabled={isLoading || !membershipId.trim()}
              >
                {isLoading ? "Checking in..." : "Check In Member"}
              </Button>
            </div>

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
              <h3 className="font-medium text-blue-800 mb-2">Instructions:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Ask the member for their membership ID</li>
                <li>• Enter the ID exactly as it appears on their card</li>
                <li>• Click "Check In Member" to complete the process</li>
                <li>• A confirmation will appear when successful</li>
              </ul>
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-700">
                  <strong>Test ID:</strong> Try using "WM-001" for testing
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