import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoTransparent from "@assets/WM Logo Moss Transparent_1751905199912.png";
import {
  Waves,
  Crown,
  Heart,
  Users,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Shield,
  Clock,
  Copy,
} from "lucide-react";

export default function LandingPage() {
  const [currentPromo, setCurrentPromo] = useState(0);

  // Fetch promotions from API
  const { data: promotions } = useQuery({
    queryKey: ["/api/promotions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/promotions");
      return await res.json();
    },
  });

  // Fetch membership plans
  const { data: membershipPlans } = useQuery({
    queryKey: ["/api/membership-plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/membership-plans");
      return await res.json();
    },
  });

  // Fetch day pass options
  const { data: dayPasses } = useQuery({
    queryKey: ["/api/punch-cards/options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/punch-cards/options");
      return await res.json();
    },
  });

  // Format price for display
  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(0)}`;
  };

  const features = [
    {
      icon: <Waves className="h-8 w-8 text-primary" />,
      title: "Sacred Thermal Sauna",
      description: "Ancient healing Sauna",
    },
    {
      icon: <Crown className="h-8 w-8 text-primary" />,
      title: "Cold Exposure",
      description: "Cold Plunge",
    },
    {
      icon: <Heart className="h-8 w-8 text-primary" />,
      title: "Wellness Sanctuary",
      description: "Complete mind-body restoration in our peaceful environment",
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Community of Wolves",
      description:
        "Join our pack of wellness warriors on the journey to vitality",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10"></div>

        {/* Animated Water Effects */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Water ripples */}
          <div className="water-container">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="water-ripple"
                style={{
                  left: `${15 + i * 12}%`,
                  top: `${20 + i * 8}%`,
                  animationDelay: `${i * 2}s`,
                  animationDuration: `${6 + (i % 2)}s`,
                }}
              />
            ))}
          </div>

          {/* Floating bubbles */}
          <div className="bubbles-container">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="water-bubble"
                style={{
                  left: `${5 + i * 6}%`,
                  animationDelay: `${i * 0.8}s`,
                  animationDuration: `${10 + (i % 4)}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <img
              src={logoTransparent}
              alt="Wolf Mother Wellness"
              className="h-32 w-32 object-contain thermal-glow"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading text-foreground mb-4">
            Wolf Mother Wellness
          </h1>

          <p className="text-lg font-body text-muted-foreground mb-2">
            Social Wellness Club 
          </p>

          <Badge className="mb-8 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            Coming soon to Kendall-Whitter Neighborhood, Tulsa, OK
          </Badge>

          <p className="text-xl md:text-2xl mb-12 text-foreground/80 max-w-3xl mx-auto leading-relaxed font-body">
            Where ancient thermal wisdom meets modern wellness.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth?tab=register">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-medium"
              >
                <Crown className="h-5 w-5 mr-2" />
                Join the Pack
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>

            <Link href="/auth?tab=login">
              <Button
                variant="outline"
                size="lg"
                className="border-primary text-primary hover:bg-primary/10 px-8 py-4 text-lg font-medium"
              >
                <Users className="h-5 w-5 mr-2" />
                Member Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Membership & Day Pass Marketing Cards */}
      <section className="py-20 px-4 bg-gradient-to-br from-background to-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
              Choose Your Wellness Path
            </h2>
            <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto">
              Select the perfect membership or day pass package to begin your
              thermal wellness journey
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            {/* Membership Plans Section */}
            <div>
              <div className="text-center mb-8">
                <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-heading font-bold text-foreground mb-2">
                  Monthly Memberships
                </h3>
                <p className="text-muted-foreground font-body">
                  Unlimited access to our thermal wellness sanctuary
                </p>
              </div>

              <div className="space-y-6">
                {membershipPlans?.map((plan: any) => (
                  <Card
                    key={plan.id}
                    className="wellness-card hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20"
                  >
                    <CardContent className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-heading font-bold text-foreground mb-2">
                            {plan.name}
                          </h4>
                          <p className="text-muted-foreground font-body">
                            {plan.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-primary">
                            {formatPrice(plan.monthlyPrice)}
                          </div>
                          <div className="text-sm text-muted-foreground font-body">
                            per month
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                        <Badge className="bg-primary/10 text-primary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Unlimited Access
                        </Badge>
                        <Badge className="bg-primary/10 text-primary">
                          <Waves className="h-3 w-3 mr-1" />
                          All Thermal Facilities
                        </Badge>
                        <Badge className="bg-primary/10 text-primary">
                          <Shield className="h-3 w-3 mr-1" />
                          Cancel Anytime
                        </Badge>
                      </div>

                      <div className="text-center">
                        <Link href="/auth?tab=register">
                          <Button className="w-full wellness-button-primary">
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Get Started
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Day Pass Packages Section */}
            <div>
              <div className="text-center mb-8">
                <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-heading font-bold text-foreground mb-2">
                  Day Pass Packages
                </h3>
                <p className="text-muted-foreground font-body">
                  Perfect for trying our facilities or occasional visits
                </p>
              </div>

              <div className="space-y-6">
                {dayPasses?.map((dayPass: any, index: number) => (
                  <Card
                    key={index}
                    className="wellness-card hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20"
                  >
                    <CardContent className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-heading font-bold text-foreground mb-2">
                            {dayPass.name}
                          </h4>
                          <p className="text-muted-foreground font-body">
                            {dayPass.totalPunches} individual day passes
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-primary">
                            {formatPrice(dayPass.totalPrice)}
                          </div>
                          <div className="text-sm text-muted-foreground font-body">
                            {formatPrice(dayPass.pricePerPunch)} per visit
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                        <Badge className="bg-secondary/80 text-secondary-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {dayPass.totalPunches} Visits
                        </Badge>
                        <Badge className="bg-secondary/80 text-secondary-foreground">
                          <Sparkles className="h-3 w-3 mr-1" />
                          No Expiration
                        </Badge>
                        {dayPass.totalPunches >= 10 && (
                          <Badge className="bg-green-100 text-green-800">
                            <Heart className="h-3 w-3 mr-1" />
                            Best Value
                          </Badge>
                        )}
                      </div>

                      <div className="text-center">
                        <Link href="/auth?tab=register">
                          <Button
                            variant="outline"
                            className="w-full border-primary text-primary hover:bg-primary hover:text-white"
                          >
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Purchase Package
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-3xl p-8 lg:p-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-heading font-bold text-foreground mb-4">
                Why Choose Wolf Mother Wellness?
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Waves className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  Ancient Wisdom
                </h4>
                <p className="text-muted-foreground font-body text-sm">
                  Traditional thermal healing practices rooted in Roman history
                </p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  Safe & Clean
                </h4>
                <p className="text-muted-foreground font-body text-sm">
                  Highest safety standards with pristine facilities maintained
                  daily
                </p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  Supportive Community
                </h4>
                <p className="text-muted-foreground font-body text-sm">
                  Join our pack of wellness warriors on their journey to
                  vitality
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promotions Carousel */}
      {promotions?.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-heading font-bold text-center mb-12 text-foreground">
              Exclusive Promotions
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {promotions?.map((promo: any, index: number) => (
                <Card
                  key={index}
                  className="border-0 shadow-lg transform hover:scale-105 transition-transform duration-300 bg-primary text-white"
                >
                  <CardHeader>
                    <CardTitle className="text-2xl font-heading font-bold">
                      {promo.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg mb-4 opacity-90 font-body">
                      {promo.description}
                    </p>
                    <div className="bg-white/20 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium font-body">
                        Promo Code:
                      </p>
                      <p className="text-xl font-bold font-mono">
                        {promo.code}
                      </p>
                    </div>
                    <p className="text-sm opacity-75 font-body">
                      {promo.validUntil}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-12 text-foreground">
            Sacred Wellness Experience
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="text-center border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-background"
              >
                <CardContent className="pt-8 pb-6">
                  <div className="flex justify-center mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-heading font-semibold mb-3 text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed font-body">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 bg-primary text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-heading font-bold mb-6">
            Ready to Begin Your Wellness Journey?
          </h2>
          <p className="text-xl mb-8 text-white/90 font-body">
            Join the Wolf Mother pack today and discover the ancient path to
            vitality
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/auth?tab=register">
              <Button
                size="lg"
                className="bg-white text-neutral-900 hover:bg-gray-100 px-10 py-6 text-xl font-bold shadow-2xl border-3 border-white hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
              >
                <CheckCircle className="h-6 w-6 mr-3" />
                Start Your Journey
              </Button>
            </Link>

            <Link href="/auth?tab=login">
              <Button
                variant="outline"
                size="lg"
                className="border-4 border-white text-white bg-transparent hover:bg-white hover:text-neutral-900 px-10 py-6 text-xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                Login to View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-12 px-4 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <MapPin className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Visit Us
              </h3>
              <p className="text-muted-foreground font-body">
                2124 E Admiral
                <br />
                Kendall Whitter Neighborhood
                <br />
                Tulsa, OK
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Phone className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Call Us
              </h3>
              <p className="text-muted-foreground font-body">
                (555) WOLF-MOM
                <br />
                Available 24/7
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Hours
              </h3>
              <p className="text-muted-foreground font-body">
                Daily: 5:00 AM - 11:00 PM
                <br />
                Sacred Waters Never Sleep
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-foreground text-background">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted font-body">
            © 2025 Wolf Mother Wellness. Where legends are born and wellness
            thrives.
          </p>
        </div>
      </footer>
    </div>
  );
}
