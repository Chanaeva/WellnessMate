import { useQuery } from "@tanstack/react-query";
import { MembershipPlan, PunchCardTemplate } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Star, Zap, Check, Ticket, Heart, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const planIcons = {
  basic: Star,
  premium: Crown,
  vip: Zap,
  daily: Ticket,
};

const planGradients = {
  basic: "from-blue-500/10 to-cyan-500/10",
  premium: "from-purple-500/10 to-pink-500/10", 
  vip: "from-amber-500/10 to-orange-500/10",
  daily: "from-green-500/10 to-emerald-500/10",
};

export default function PackagesPage() {
  // Fetch membership plans
  const { data: membershipPlans, isLoading: isPlansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Fetch punch card options
  const { data: punchCardOptions, isLoading: isPunchCardsLoading } = useQuery<{name: string, totalPunches: number, totalPrice: number, pricePerPunch: number}[]>({
    queryKey: ["/api/punch-cards/options"],
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  if (isPlansLoading || isPunchCardsLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading packages...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow wellness-container py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading text-foreground mb-4">
            Membership Plans & Packages
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect wellness plan for your thermal therapy journey. From flexible day passes to comprehensive memberships.
          </p>
        </div>

        <Tabs defaultValue="memberships" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="memberships" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Memberships
            </TabsTrigger>
            <TabsTrigger value="day-passes" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Day Passes
            </TabsTrigger>
          </TabsList>

          {/* Membership Plans Tab */}
          <TabsContent value="memberships" className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-heading text-foreground mb-2">Monthly Memberships</h2>
              <p className="text-muted-foreground">Unlimited access with exclusive member benefits</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {membershipPlans?.map((plan) => {
                const IconComponent = planIcons[plan.planType as keyof typeof planIcons] || Star;
                const gradientClass = planGradients[plan.planType as keyof typeof planGradients] || planGradients.basic;
                
                return (
                  <Card key={plan.id} className={`wellness-card relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${plan.planType === 'vip' ? 'border-amber-500/50 shadow-amber-500/20' : ''}`}>
                    {plan.planType === 'vip' && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-amber-500 text-amber-50 border-amber-400">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    
                    <div className={`h-32 bg-gradient-to-br ${gradientClass} relative`}>
                      <div className="absolute inset-0 bg-black/5"></div>
                      <div className="relative h-full flex items-center justify-center">
                        <IconComponent className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                    
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-heading capitalize">
                        {plan.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {plan.description}
                      </CardDescription>
                      <div className="text-3xl font-bold text-primary">
                        {formatPrice(plan.monthlyPrice)}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pb-6">
                      <div className="space-y-3">
                        {plan.features?.map((feature, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-foreground">{feature}</span>
                          </div>
                        )) || (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-success mt-0.5" />
                              <span className="text-sm text-foreground">Unlimited facility access</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-success mt-0.5" />
                              <span className="text-sm text-foreground">All thermal therapy options</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-success mt-0.5" />
                              <span className="text-sm text-foreground">Mobile check-in</span>
                            </div>
                            {plan.planType !== 'basic' && (
                              <div className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-success mt-0.5" />
                                <span className="text-sm text-foreground">Priority booking</span>
                              </div>
                            )}
                            {plan.planType === 'vip' && (
                              <>
                                <div className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-success mt-0.5" />
                                  <span className="text-sm text-foreground">Guest passes included</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Check className="h-4 w-4 text-success mt-0.5" />
                                  <span className="text-sm text-foreground">Exclusive VIP hours</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-0">
                      <Link href="/member-dashboard" className="w-full">
                        <Button className="w-full wellness-button-primary">
                          Choose Plan
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Day Passes Tab */}
          <TabsContent value="day-passes" className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-heading text-foreground mb-2">Day Pass Packages</h2>
              <p className="text-muted-foreground">Flexible visits for occasional wellness sessions</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {punchCardOptions?.map((option, index) => (
                <Card key={index} className="wellness-card relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <div className="h-32 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 relative">
                    <div className="absolute inset-0 bg-black/5"></div>
                    <div className="relative h-full flex items-center justify-center">
                      <Ticket className="h-12 w-12 text-emerald-600" />
                    </div>
                  </div>
                  
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-heading">
                      {option.name}
                    </CardTitle>
                    <CardDescription>
                      {option.totalPunches} individual day passes
                    </CardDescription>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-primary">
                        {formatPrice(option.totalPrice)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(option.pricePerPunch)} per visit
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success mt-0.5" />
                        <span className="text-sm text-foreground">Full facility access per visit</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success mt-0.5" />
                        <span className="text-sm text-foreground">All thermal therapy options</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success mt-0.5" />
                        <span className="text-sm text-foreground">6-month expiration</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success mt-0.5" />
                        <span className="text-sm text-foreground">Mobile check-in</span>
                      </div>
                    </div>
                    
                    {option.totalPunches >= 10 && (
                      <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-success" />
                          <span className="text-sm font-medium text-success">
                            Best Value - Save ${((25 * option.totalPunches - option.totalPrice) / 100).toFixed(0)}!
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <Link href="/member-dashboard" className="w-full">
                      <Button className="w-full wellness-button-primary">
                        Purchase Package
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Facility Overview Section */}
        <div className="mt-16 space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-heading text-foreground mb-2">What's Included</h2>
            <p className="text-muted-foreground">All plans include access to our premium thermal wellness facilities</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="wellness-card text-center">
              <CardContent className="p-6">
                <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center">
                  <Heart className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Finnish Saunas</h3>
                <p className="text-sm text-muted-foreground">Traditional dry heat therapy rooms maintained at optimal temperatures for deep relaxation and detoxification.</p>
              </CardContent>
            </Card>
            
            <Card className="wellness-card text-center">
              <CardContent className="p-6">
                <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Cold Plunge Pools</h3>
                <p className="text-sm text-muted-foreground">Invigorating cold therapy pools designed to boost circulation and enhance recovery.</p>
              </CardContent>
            </Card>
            
            <Card className="wellness-card text-center">
              <CardContent className="p-6">
                <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                  <Star className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Premium Amenities</h3>
                <p className="text-sm text-muted-foreground">Luxury changing areas, premium towels, and all the amenities you need for the perfect wellness session.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="wellness-card bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-8">
              <h2 className="text-2xl font-heading text-foreground mb-4">Ready to Start Your Wellness Journey?</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join Wolf Mother Wellness today and discover the transformative power of thermal therapy. Choose your plan and start experiencing the benefits of regular sauna and cold plunge sessions.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/member-dashboard">
                  <Button size="lg" className="wellness-button-primary">
                    Get Started Today
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <a 
                  href="https://www.wolfmothertulsa.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="outline">
                    Learn More About Our Facility
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}