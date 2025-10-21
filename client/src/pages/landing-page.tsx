import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioControls } from "@/components/ui/audio-controls";
import logoTransparent from "@assets/WM Logo Moss Transparent_1751905199912.png";
import coldPlungeImg from "@assets/LIT_1759176133152.png";
import saunaImg from "@assets/nomadsaunainside_1759176129008.png";
import { format } from "date-fns";
import type { MembershipPlan } from "@shared/schema";
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
  Instagram,
  Building2,
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

  // Fetch footer settings
  const { data: footerSettings } = useQuery({
    queryKey: ["/api/landing-content/footer"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/footer");
      const data = await res.json();
      
      return {
        hoursOfOperation: data.find((s: any) => s.key === 'hoursOfOperation')?.value || '6:00 AM - 10:00 PM',
        hoursMembers: data.find((s: any) => s.key === 'hoursMembers')?.value || '6:00 AM - 9:00 AM',
        hoursDayPass: data.find((s: any) => s.key === 'hoursDayPass')?.value || '9:00 AM - 10:00 PM',
        address: data.find((s: any) => s.key === 'address')?.value || '2124 W Admiral',
        addressLine2: data.find((s: any) => s.key === 'addressLine2')?.value || 'Kendall Whitter Neighborhood\nTulsa, OK',
        copyrightYear: data.find((s: any) => s.key === 'copyrightYear')?.value || '2025',
        instagramHandle: data.find((s: any) => s.key === 'instagramHandle')?.value || 'wolfmothertulsa',
      };
    },
  });

  // Fetch hero content
  const { data: heroContent } = useQuery({
    queryKey: ["/api/landing-content/hero"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/hero");
      const data = await res.json();
      
      return {
        title: data.find((s: any) => s.key === 'title')?.value || '',
        subtitle: data.find((s: any) => s.key === 'subtitle')?.value || '',
        description: data.find((s: any) => s.key === 'description')?.value || '',
        badgeText: data.find((s: any) => s.key === 'badgeText')?.value || '',
      };
    },
  });

  // Fetch features content
  const { data: featuresContent } = useQuery({
    queryKey: ["/api/landing-content/features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/features");
      const data = await res.json();
      
      return [
        {
          title: data.find((s: any) => s.key === 'feature1Title')?.value || '',
          description: data.find((s: any) => s.key === 'feature1Description')?.value || '',
        },
        {
          title: data.find((s: any) => s.key === 'feature2Title')?.value || '',
          description: data.find((s: any) => s.key === 'feature2Description')?.value || '',
        },
        {
          title: data.find((s: any) => s.key === 'feature3Title')?.value || '',
          description: data.find((s: any) => s.key === 'feature3Description')?.value || '',
        },
        {
          title: data.find((s: any) => s.key === 'feature4Title')?.value || '',
          description: data.find((s: any) => s.key === 'feature4Description')?.value || '',
        },
      ];
    },
  });

  // Fetch benefits content
  const { data: benefitsContent } = useQuery({
    queryKey: ["/api/landing-content/benefits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/benefits");
      const data = await res.json();
      
      return [
        {
          title: data.find((s: any) => s.key === 'benefit1Title')?.value || '',
          description: data.find((s: any) => s.key === 'benefit1Description')?.value || '',
        },
        {
          title: data.find((s: any) => s.key === 'benefit2Title')?.value || '',
          description: data.find((s: any) => s.key === 'benefit2Description')?.value || '',
        },
        {
          title: data.find((s: any) => s.key === 'benefit3Title')?.value || '',
          description: data.find((s: any) => s.key === 'benefit3Description')?.value || '',
        },
      ];
    },
  });

  // Fetch partners content
  const { data: partnersContent } = useQuery({
    queryKey: ["/api/landing-content/partners"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/partners");
      const data = await res.json();
      
      return [
        {
          name: data.find((s: any) => s.key === 'partner1Name')?.value || '',
          description: data.find((s: any) => s.key === 'partner1Description')?.value || '',
        },
        {
          name: data.find((s: any) => s.key === 'partner2Name')?.value || '',
          description: data.find((s: any) => s.key === 'partner2Description')?.value || '',
        },
      ];
    },
  });

  // Format price for display
  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(0)}`;
  };

  // Format availability dates (using UTC to avoid timezone shifts)
  const formatAvailabilityDates = (availableFrom?: Date | null, availableUntil?: Date | null) => {
    if (!availableFrom) return null;
    
    const fromDate = new Date(availableFrom);
    const fromFormatted = format(new Date(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()), 'MMM d, yyyy');
    
    if (!availableUntil) {
      return `Available ${fromFormatted} onwards`;
    }
    
    const untilDate = new Date(availableUntil);
    const untilFormatted = format(new Date(untilDate.getUTCFullYear(), untilDate.getUTCMonth(), untilDate.getUTCDate()), 'MMM d, yyyy');
    return `${fromFormatted} - ${untilFormatted}`;
  };

  // Feature icons mapping
  const featureIcons = [
    <Waves className="h-8 w-8 text-primary" />,
    <Crown className="h-8 w-8 text-primary" />,
    <Heart className="h-8 w-8 text-primary" />,
    <Users className="h-8 w-8 text-primary" />,
  ];

  // Benefit icons mapping
  const benefitIcons = [
    <Waves className="h-8 w-8 text-primary" />,
    <Shield className="h-8 w-8 text-primary" />,
    <Users className="h-8 w-8 text-primary" />,
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Floating Audio Player */}
      <div className="fixed top-4 right-4 z-50">
        <AudioControls />
      </div>

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
            {heroContent?.title}
          </h1>

          <p className="text-lg font-body text-muted-foreground mb-2">
            {heroContent?.subtitle}
          </p>

          <Badge className="mb-8 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            {heroContent?.badgeText}
          </Badge>

          <p className="text-xl md:text-2xl mb-12 text-foreground/80 max-w-3xl mx-auto leading-relaxed font-body">
            {heroContent?.description}
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
                {membershipPlans?.map((plan: MembershipPlan) => (
                  <Card
                    key={plan.id}
                    className="wellness-card hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20"
                  >
                    <CardContent className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-heading font-bold text-foreground mb-2">
                            {plan.name}
                          </h4>
                          <p className="text-muted-foreground font-body mb-3">
                            {plan.description}
                          </p>
                          {formatAvailabilityDates(plan.availableFrom, plan.availableUntil) && (
                            <Badge variant="outline" className="w-fit text-xs border-primary/30 bg-primary/5">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatAvailabilityDates(plan.availableFrom, plan.availableUntil)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right ml-4">
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
              {benefitsContent?.map((benefit, index) => (
                <div key={index} className="text-center">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    {benefitIcons[index]}
                  </div>
                  <h4 className="font-heading font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h4>
                  <p className="text-muted-foreground font-body text-sm">
                    {benefit.description}
                  </p>
                </div>
              ))}
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
      {/* Partners Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-background to-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-heading font-bold text-foreground mb-4">
              Our Partners
            </h2>
            <p className="text-xl text-muted-foreground font-body">
              We are working with industry-leading wellness providers
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {partnersContent?.map((partner, index) => (
              <Card key={index} className="overflow-hidden border-2 hover:border-primary/20 transition-all duration-300 hover:shadow-xl">
                <div className="aspect-video overflow-hidden">
                  <img
                    src={index === 0 ? coldPlungeImg : saunaImg}
                    alt={partner.name}
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-heading font-bold text-foreground mb-3">
                    {partner.name}
                  </h3>
                  <p className="text-muted-foreground font-body leading-relaxed">
                    {partner.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-12 text-foreground">
            Sacred Wellness Experience
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuresContent?.map((feature, index) => (
              <Card
                key={index}
                className="text-center border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-background"
              >
                <CardContent className="pt-8 pb-6">
                  <div className="flex justify-center mb-4">{featureIcons[index]}</div>
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

      {/* Contact Info / Footer */}
      <footer className="py-12 px-4 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center mb-8">
            <div className="flex flex-col items-center">
              <MapPin className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Visit Us
              </h3>
              <p className="text-muted-foreground font-body">
                {footerSettings?.address || '2124 E Admiral'}
                <br />
                {footerSettings?.addressLine2?.split('\n').map((line: string, i: number) => (
                  <span key={i}>
                    {line}
                    {i < (footerSettings?.addressLine2?.split('\n').length || 1) - 1 && <br />}
                  </span>
                )) || (
                  <>
                    Kendall Whitter Neighborhood
                    <br />
                    Tulsa, OK
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Daily Hours
              </h3>
              <p className="text-muted-foreground font-body">
                Hours of Operation: {footerSettings?.hoursOfOperation || '6:00 AM - 10:00 PM'}
                <br />
                Members Only Access: {footerSettings?.hoursMembers || '6:00 AM - 9:00 AM'}
                <br />
                Day Pass Access: {footerSettings?.hoursDayPass || '9:00 AM - 10:00 PM'}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Instagram className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Connect
              </h3>
              <p className="text-muted-foreground font-body">
                {footerSettings?.instagramHandle ? (
                  <a
                    href={`https://instagram.com/${footerSettings.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-2"
                    data-testid="link-instagram"
                  >
                    <Instagram className="h-5 w-5" />
                    @{footerSettings.instagramHandle}
                  </a>
                ) : (
                  <a
                    href="mailto:info@wolfmotherwellness.com"
                    className="hover:underline"
                  >
                    info@wolfmotherwellness.com
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="text-center pt-6 border-t border-muted-foreground/20">
            <p className="text-muted-foreground font-body text-sm">
              © {footerSettings?.copyrightYear || '2025'} Wolf Mother Wellness. Where legends are born and wellness thrives.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
