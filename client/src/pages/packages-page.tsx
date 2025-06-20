import { useQuery } from "@tanstack/react-query";
import { MembershipPlan, PunchCardTemplate } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Star, Zap, Check, Ticket, Heart, Sparkles, ArrowRight, ShoppingCart, Shield, Flame, Waves } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";

const planIcons = {
  basic: Shield,
  premium: Crown,
  vip: Flame,
  daily: Waves,
};

const planThemes = {
  basic: {
    gradient: "from-moss-green/20 to-neutral-500/20",
    accentColor: "text-moss-green",
    iconBg: "bg-moss-green/10",
    border: "border-moss-green/20",
    title: "Foundling's Path",
    subtitle: "Begin your wellness journey"
  },
  premium: {
    gradient: "from-amber-600/20 to-yellow-600/20",
    accentColor: "text-amber-600",
    iconBg: "bg-amber-600/10",
    border: "border-amber-600/20",
    title: "Warrior's Strength",
    subtitle: "Enhanced thermal experience"
  },
  vip: {
    gradient: "from-red-600/20 to-orange-600/20",
    accentColor: "text-red-600",
    iconBg: "bg-red-600/10",
    border: "border-red-600/20",
    title: "Wolf Mother's Blessing",
    subtitle: "Ultimate wellness sanctuary"
  },
  daily: {
    gradient: "from-blue-600/20 to-teal-600/20",
    accentColor: "text-blue-600",
    iconBg: "bg-blue-600/10",
    border: "border-blue-600/20",
    title: "Tiber's Flow",
    subtitle: "Flexible wellness visits"
  },
};

export default function PackagesPage() {
  const { addItem } = useCart();
  const { toast } = useToast();

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

  const handleAddMembershipToCart = (plan: MembershipPlan) => {
    addItem({
      id: `membership-${plan.id}`,
      type: 'membership',
      name: plan.name,
      price: plan.monthlyPrice,
      description: plan.description,
      data: plan
    });
    toast({
      title: "Added to Cart",
      description: `${plan.name} has been added to your cart.`,
    });
  };

  const handleAddPunchCardToCart = (option: any) => {
    addItem({
      id: `punch-card-${option.name.replace(/\s+/g, '-').toLowerCase()}`,
      type: 'punch_card',
      name: option.name,
      price: option.totalPrice,
      description: `${option.totalPunches} day passes`,
      data: option
    });
    toast({
      title: "Added to Cart",
      description: `${option.name} has been added to your cart.`,
    });
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
                          <div key={index} className="flex items-start gap-3">
                            <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                              <Check className={`h-3 w-3 ${theme.accentColor}`} />
                            </div>
                            <span className="text-sm text-neutral-700">{feature}</span>
                          </div>
                        )) || (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                <Check className={`h-3 w-3 ${theme.accentColor}`} />
                              </div>
                              <span className="text-sm text-neutral-700">Sacred waters access</span>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                <Check className={`h-3 w-3 ${theme.accentColor}`} />
                              </div>
                              <span className="text-sm text-neutral-700">All thermal sanctuaries</span>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                <Check className={`h-3 w-3 ${theme.accentColor}`} />
                              </div>
                              <span className="text-sm text-neutral-700">Digital check-in</span>
                            </div>
                            {plan.planType !== 'basic' && (
                              <div className="flex items-start gap-3">
                                <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                  <Check className={`h-3 w-3 ${theme.accentColor}`} />
                                </div>
                                <span className="text-sm text-neutral-700">Priority reservations</span>
                              </div>
                            )}
                            {plan.planType === 'vip' && (
                              <>
                                <div className="flex items-start gap-3">
                                  <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                    <Check className={`h-3 w-3 ${theme.accentColor}`} />
                                  </div>
                                  <span className="text-sm text-neutral-700">Guest privileges</span>
                                </div>
                                <div className="flex items-start gap-3">
                                  <div className={`${theme.iconBg} p-1 rounded-full mt-0.5`}>
                                    <Check className={`h-3 w-3 ${theme.accentColor}`} />
                                  </div>
                                  <span className="text-sm text-neutral-700">Exclusive sanctuary hours</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-0">
                      <Button 
                        className={`w-full wellness-button-primary bg-gradient-to-r ${theme.gradient} hover:opacity-90 transition-all duration-300 font-medium border-0 text-neutral-800 hover:text-neutral-900`}
                        onClick={() => handleAddMembershipToCart(plan)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Begin Journey
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Day Passes Tab */}
          <TabsContent value="day-passes" className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-heading text-foreground mb-2">Sacred Passages</h2>
              <p className="text-muted-foreground">Flexible visits to the thermal sanctuaries when your spirit calls</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {punchCardOptions?.map((option, index) => (
                <Card key={index} className="wellness-card relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 border-blue-600/20 bg-gradient-to-br from-white to-blue-50/30">
                  <div className="h-40 bg-gradient-to-br from-blue-600/20 to-teal-600/20 relative">
                    <div className="absolute inset-0 bg-black/5"></div>
                    <div className="absolute inset-0 bg-[url('/api/placeholder/400/160')] bg-cover bg-center opacity-5"></div>
                    <div className="relative h-full flex flex-col items-center justify-center p-4">
                      <div className="bg-blue-600/10 p-3 rounded-full mb-2">
                        <Waves className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-heading text-blue-600 text-center">
                        Sacred Passage
                      </h3>
                      <p className="text-xs text-neutral-600 text-center mt-1">
                        Flexible wellness visits
                      </p>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-heading">
                      {option.name}
                    </CardTitle>
                    <CardDescription className="text-neutral-600">
                      {option.totalPunches} sacred sanctuary visits
                    </CardDescription>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-blue-600">
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
                    <Button 
                      className="w-full wellness-button-primary"
                      onClick={() => handleAddPunchCardToCart(option)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart
                    </Button>
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


      </main>
      
      <Footer />
    </div>
  );
}