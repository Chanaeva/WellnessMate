import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Membership, CheckIn, MembershipPlan, PunchCard } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MemberCard from "@/components/dashboard/member-card";
import StatsCard from "@/components/dashboard/stats-card";
import ScheduleItem from "@/components/dashboard/schedule-item";
import { Link } from "wouter";
import { 
  QrCode, 
  Calendar, 
  Users, 
  Settings, 
  CreditCard, 
  ArrowRight,
  CheckCircle,
  XCircle,
  Volleyball,
  Heart,
  Sparkles,
  Ticket
} from "lucide-react";
import { format } from "date-fns";

export default function MemberDashboard() {
  const { user } = useAuth();

  // Fetch membership data
  const { data: membership, isLoading: isMembershipLoading } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch check-ins data
  const { data: checkIns, isLoading: isCheckInsLoading } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Fetch user's punch cards
  const { data: userPunchCards } = useQuery<PunchCard[]>({
    queryKey: ["/api/punch-cards"],
    enabled: !!user,
  });

  // Calculate membership status and information
  const membershipStatus = membership?.status || "inactive";
  const membershipEndDate = membership ? new Date(membership.endDate) : new Date();
  const formattedEndDate = membership ? format(membershipEndDate, "MMMM d, yyyy") : "N/A";
  const currentPlan = membershipPlans?.find(plan => plan.planType === membership?.planType);
  


  // Calculate total check-ins this month
  const currentMonth = new Date().getMonth();
  const checkInsThisMonth = checkIns?.filter(checkIn => {
    if (!checkIn.timestamp) return false;
    const checkInDate = new Date(checkIn.timestamp.toString());
    return checkInDate.getMonth() === currentMonth;
  }).length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow wellness-container py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column (2/3) */}
          <div className="md:w-2/3 space-y-6">
            {/* Welcome Banner */}
            <Card className="wellness-card overflow-hidden">
              <div className="h-40 thermal-gradient relative">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative h-full p-6 flex items-end">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-white">
                      Welcome back, {user?.firstName || "Member"}!
                    </h1>
                    <p className="text-white/90 font-medium">
                      Your membership is {membershipStatus === "active" ? "active until" : "expired on"} {formattedEndDate}
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 flex justify-between items-center bg-card">
                <div>
                  <div className="text-sm text-muted-foreground">Recent Check-ins</div>
                  <div className="text-xl font-semibold text-foreground">{checkInsThisMonth} this month</div>
                </div>
                <div>
                  <Link href="/qr-code">
                    <Button className="wellness-button-primary flex items-center">
                      <QrCode className="mr-2 h-4 w-4" /> Check In Now
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>



            {/* Facilities */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-2xl font-display font-bold mb-6 text-foreground">Our Thermal Facilities</h2>
                <div className="wellness-grid">
                  {/* Facility Item 1 */}
                  <div className="wellness-card overflow-hidden">
                    <div className="h-32 thermal-gradient relative">
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative h-full flex items-center justify-center">
                        <Heart className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground">Finnish Saunas</h4>
                      <p className="text-sm text-muted-foreground mt-1">Open 24/7 • Traditional dry heat therapy</p>
                      <Badge className="thermal-badge-primary mt-2">Available</Badge>
                    </div>
                  </div>
                  
                  {/* Facility Item 2 */}
                  <div className="wellness-card overflow-hidden">
                    <div className="h-32 cold-gradient relative">
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative h-full flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground">Cold Plunge Pools</h4>
                      <p className="text-sm text-muted-foreground mt-1">Invigorating cold therapy • Health benefits</p>
                      <Badge className="thermal-badge-info mt-2">Available</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Thermal Wellness Benefits */}
            <Card className="wellness-card">
              <CardContent className="p-6">
                <h2 className="text-2xl font-display font-bold mb-6 text-foreground">Thermal Wellness Benefits</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Improved Circulation</h4>
                      <p className="text-sm text-muted-foreground mt-1">Regular sauna sessions can improve cardiovascular health and blood flow</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-secondary/10 p-3 rounded-xl">
                      <Sparkles className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Stress Reduction</h4>
                      <p className="text-sm text-muted-foreground mt-1">Thermal therapy helps reduce cortisol levels and promotes relaxation</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="bg-accent/10 p-3 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Immune System Support</h4>
                      <p className="text-sm text-muted-foreground mt-1">Hot and cold contrast therapy can help strengthen your immune response</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1/3) */}
          <div className="md:w-1/3 space-y-6">
            {/* Membership Card */}
            <MemberCard 
              user={user} 
              membership={membership}
              membershipEndDate={formattedEndDate}
              planName={currentPlan?.name || "Basic Membership"}
              memberSince="Jan 2023"
            />

            {/* Digital Punch Cards - Show when purchased */}
            {userPunchCards && userPunchCards.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Ticket className="h-5 w-5 text-amber-600 mr-2" />
                    Your Digital Punch Cards
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-3">
                    {userPunchCards.map((card) => (
                      <div key={card.id} className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-amber-800">{card.name}</h4>
                          <Badge className={`${card.status === 'active' ? 'bg-green-500' : card.status === 'exhausted' ? 'bg-red-500' : 'bg-gray-500'} text-white`}>
                            {card.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Remaining:</span>
                          <span className="font-bold text-amber-700">{card.remainingPunches} visits</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-gray-600">Total:</span>
                          <span className="text-gray-700">{card.totalPunches} visits</span>
                        </div>
                        {card.status === 'active' && (
                          <div className="mt-3">
                            <Link href="/qr-code">
                              <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700">
                                Use for Check-in
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Link href="/qr-code">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <QrCode className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">View My QR Code</span>
                    </Button>
                  </Link>
                  <Link href="/payments">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <CreditCard className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">Payment History</span>
                    </Button>
                  </Link>
                  <Link href="/membership">
                    <Button variant="outline" className="w-full h-full flex flex-col items-center justify-center bg-muted hover:bg-muted/80 py-6">
                      <Users className="h-6 w-6 text-primary mb-2" />
                      <span className="text-sm text-center">Membership</span>
                    </Button>
                  </Link>
                </div>
                
                {/* External Links Section */}
                <div className="border-t border-border pt-4 space-y-3">
                  <a 
                    href="https://www.wolfmothertulsa.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" className="w-full flex items-center justify-center bg-primary/5 hover:bg-primary/10 py-3 border-primary/20">
                      <svg className="h-5 w-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                      </svg>
                      <span className="text-sm text-primary font-medium">Visit Our Website</span>
                    </Button>
                  </a>
                  
                  {/* Admin Access */}
                  <Link href="/admin-login">
                    <Button variant="outline" className="w-full flex items-center justify-center bg-muted hover:bg-muted/80 py-3">
                      <Settings className="h-5 w-5 text-muted-foreground mr-2" />
                      <span className="text-sm text-muted-foreground">Admin Login</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Notifications</h3>
                  <Button variant="link" className="text-primary">
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="border-l-4 border-[#FF7F50] bg-[#FF7F50]/5 p-3 rounded-r-lg">
                    <h4 className="font-medium text-sm">New Thermal Sessions</h4>
                    <p className="text-sm text-gray-600 mt-1">New guided sauna sessions added to the schedule. Reserve now!</p>
                    <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                  </div>
                  <div className="border-l-4 border-green-500 bg-green-500/5 p-3 rounded-r-lg">
                    <h4 className="font-medium text-sm">Payment Successful</h4>
                    <p className="text-sm text-gray-600 mt-1">Your thermal wellness membership payment was processed successfully.</p>
                    <p className="text-xs text-gray-500 mt-1">Yesterday</p>
                  </div>
                  <div className="border-l-4 border-gray-300 bg-gray-50 p-3 rounded-r-lg">
                    <h4 className="font-medium text-sm">Maintenance Notice</h4>
                    <p className="text-sm text-gray-600 mt-1">The Finnish sauna will be closed for maintenance on Saturday.</p>
                    <p className="text-xs text-gray-500 mt-1">2 days ago</p>
                  </div>
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
