import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Membership, MembershipPlan } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Check, Calendar, CreditCard, AlertTriangle, Crown, ArrowRight, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

export default function MembershipPage() {
  const { user } = useAuth();

  // Fetch membership data
  const { data: membership, isLoading: isMembershipLoading } = useQuery<Membership>({
    queryKey: ["/api/membership"],
    enabled: !!user,
  });

  // Fetch membership plans
  const { data: membershipPlans, isLoading: isPlansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  const currentPlan = membershipPlans?.find(plan => plan.planType === membership?.planType);
  const isActive = membership?.status === 'active';

  if (isMembershipLoading || isPlansLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow wellness-container py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-display font-bold text-foreground">Your Membership</h1>
            <p className="text-xl text-muted-foreground">
              Manage your Wolf Mother Wellness membership
            </p>
          </div>

          {/* Active Membership Display */}
          {isActive && membership && currentPlan ? (
            <Card className="wellness-card overflow-hidden">
              {/* Gradient Header */}
              <div className="h-40 thermal-gradient relative">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative h-full p-8 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <Crown className="h-6 w-6 text-white" />
                      <Badge className="bg-white/20 text-white border-white/30 text-sm">
                        Active Membership
                      </Badge>
                    </div>
                    <h2 className="text-3xl font-display font-bold text-white">
                      {currentPlan.name}
                    </h2>
                    <p className="text-white/90 text-lg mt-1">
                      Member ID: {membership.membershipId}
                    </p>
                  </div>
                  <div className="text-right text-white">
                    <div className="text-white/80 text-lg">Monthly</div>
                    <div className="text-4xl font-bold">${(currentPlan.monthlyPrice / 100).toFixed(0)}</div>
                  </div>
                </div>
              </div>

              <CardContent className="p-8">
                {/* Membership Details */}
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Next Billing Date</span>
                      </div>
                      <span className="font-semibold">
                        {format(new Date(membership.endDate), "MMMM dd, yyyy")}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Plan Type</span>
                      </div>
                      <span className="font-semibold capitalize">{membership.planType}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Status</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Active
                      </Badge>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Included Features</h3>
                    <div className="space-y-3">
                      {currentPlan.features?.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border">
                  <Link href="/payments" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" />
                      View Payment History
                    </Button>
                  </Link>
                  <Link href="/payments" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase Add-ons
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* No Active Membership */
            <Card className="wellness-card text-center">
              <CardHeader className="py-12">
                <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl mb-4">No Active Membership</CardTitle>
                <CardDescription className="text-lg">
                  You don't currently have an active membership. Purchase a plan to access all thermal wellness facilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-12">
                <Link href="/">
                  <Button size="lg" className="wellness-button-primary">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Browse Membership Plans
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Membership Benefits */}
          <Card className="wellness-card">
            <CardHeader>
              <CardTitle className="text-2xl">Wolf Mother Wellness Benefits</CardTitle>
              <CardDescription>
                Discover what makes our thermal wellness center special
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Finnish Saunas</h3>
                  <p className="text-sm text-muted-foreground">
                    Traditional dry heat therapy for cardiovascular health and relaxation
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Cold Plunge</h3>
                  <p className="text-sm text-muted-foreground">
                    Invigorating cold therapy to boost immunity and mental clarity
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Infrared Therapy</h3>
                  <p className="text-sm text-muted-foreground">
                    Deep tissue healing and detoxification through infrared heat
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}