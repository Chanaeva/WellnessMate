import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Sidebar from "@/components/layout/sidebar";
import StatsCard from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRScanner } from "@/components/ui/qr-scanner";
import { 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  DollarSign,
  Search,
  QrCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { User, CheckIn } from "@shared/schema";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch members data
  const { data: members } = useQuery<(User & {membership?: any})[]>({
    queryKey: ["/api/admin/members"],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch today's check-ins
  const { data: todayCheckIns } = useQuery<CheckIn[]>({
    queryKey: ["/api/admin/check-ins/today"],
    enabled: !!user && user.role === 'admin',
  });

  const handleScan = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      toast({
        title: "Valid QR code scanned",
        description: `Member ID: ${parsed.membershipId}`,
      });
      // In a real app, this would process the check-in
    } catch (error) {
      toast({
        title: "Invalid QR code",
        description: "The scanned QR code is not valid.",
        variant: "destructive",
      });
    }
  };

  // Mock data for display purposes
  const activeMembers = members?.filter(m => m.membership?.status === 'active').length || 0;
  const todayCheckins = todayCheckIns?.length || 0;
  const newMembersThisMonth = members?.filter(m => {
    const createdDate = new Date(m.createdAt);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && 
           createdDate.getFullYear() === now.getFullYear();
  }).length || 0;
  
  // Recent check-ins for display
  const recentCheckIns = todayCheckIns?.slice(0, 3).map(checkIn => {
    const member = members?.find(m => m.id === checkIn.userId);
    return {
      id: checkIn.id,
      name: member ? `${member.firstName} ${member.lastName}` : 'Unknown',
      time: format(new Date(checkIn.timestamp), 'h:mm a'),
      membershipType: member?.membership?.planType || 'basic'
    };
  }) || [];

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-1/5">
            <Sidebar />
          </div>

          {/* Main Content Area */}
          <div className="lg:w-4/5 space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard 
                title="Active Members" 
                value={activeMembers}
                icon={UserIcon}
                iconColor="text-primary"
                iconBgColor="bg-primary/10"
                change={{ value: 12, label: "vs. last month", positive: true }}
              />
              <StatsCard 
                title="Today's Check-ins" 
                value={todayCheckins}
                icon={LogIn}
                iconColor="text-secondary"
                iconBgColor="bg-secondary/10"
                change={{ value: 8, label: "vs. yesterday", positive: true }}
              />
              <StatsCard 
                title="New Members" 
                value={newMembersThisMonth}
                icon={UserPlus}
                iconColor="text-[#FF7F50]"
                iconBgColor="bg-[#FF7F50]/10"
                change={{ value: 5, label: "vs. last month", positive: false }}
              />
              <StatsCard 
                title="Revenue (MTD)" 
                value="$12,548"
                icon={DollarSign}
                iconColor="text-green-700"
                iconBgColor="bg-green-100"
                change={{ value: 18, label: "vs. last month", positive: true }}
              />
            </div>

            {/* Check-in Quick Access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold">Quick Check-in</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/2">
                    <div className="flex">
                      <Input 
                        type="text" 
                        placeholder="Search by name or member ID" 
                        className="rounded-r-none"
                      />
                      <Button className="bg-primary hover:bg-primary/90 rounded-l-none">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4">
                      <Button 
                        className="w-full bg-secondary hover:bg-secondary/90 flex items-center justify-center"
                      >
                        <QrCode className="mr-2 h-4 w-4" /> Scan QR Code
                      </Button>
                    </div>
                    
                    <div className="mt-4">
                      <QRScanner 
                        onScan={handleScan}
                        onError={(error) => {
                          toast({
                            title: "Scanner Error",
                            description: error,
                            variant: "destructive",
                          });
                        }}
                        height={200}
                        width={200}
                      />
                    </div>
                  </div>
                  <div className="md:w-1/2 bg-neutral-light rounded-lg p-4 border border-gray-200">
                    <h4 className="font-medium mb-3">Recent Check-ins</h4>
                    <div className="space-y-3">
                      {recentCheckIns.length > 0 ? (
                        recentCheckIns.map((checkIn) => (
                          <div key={checkIn.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-medium mr-3">
                                {checkIn.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <h5 className="font-medium text-sm">{checkIn.name}</h5>
                                <p className="text-xs text-gray-500">{checkIn.time} today</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={
                              checkIn.membershipType === 'premium' ? 'bg-green-100 text-green-800' :
                              checkIn.membershipType === 'vip' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }>
                              {checkIn.membershipType.charAt(0).toUpperCase() + checkIn.membershipType.slice(1)}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          No check-ins recorded today
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Member Management Preview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold">Member Management</CardTitle>
                <div className="flex space-x-2">
                  <Button className="bg-primary hover:bg-primary/90 flex items-center">
                    <UserPlus className="mr-2 h-4 w-4" /> Add New Member
                  </Button>
                  <Button variant="outline" className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-filter mr-2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Check-in</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members && members.slice(0, 5).map((member, index) => (
                        <tr key={member.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                                {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName}</div>
                                <div className="text-xs text-gray-500">{member.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={
                              member.membership?.status === 'active' ? 'bg-green-100 text-green-800' :
                              member.membership?.status === 'inactive' ? 'bg-red-100 text-red-800' :
                              member.membership?.status === 'expired' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {member.membership?.status 
                                ? member.membership.status.charAt(0).toUpperCase() + member.membership.status.slice(1)
                                : 'No Membership'
                              }
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {member.membership?.planType || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Unknown
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-8 w-8 p-0" title="View Profile">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                              </Button>
                              <Button variant="ghost" size="sm" className="text-secondary hover:text-secondary/80 h-8 w-8 p-0" title="Edit Member">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                              </Button>
                              <Button variant="ghost" size="sm" className="text-[#FF7F50] hover:text-[#FF7F50]/80 h-8 w-8 p-0" title="Manage QR Code">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-qr-code"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Showing {members ? Math.min(members.length, 5) : 0} of {members?.length || 0} members
                  </div>
                  <Button variant="outline" className="flex items-center">
                    View All Members
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right ml-2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
