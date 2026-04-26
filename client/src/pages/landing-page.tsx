import { useState, useEffect, useCallback } from "react";
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
import useEmblaCarousel from "embla-carousel-react";
import type { MembershipPlan, Notification, SessionConfig, DayPassHours, GalleryImage } from "@shared/schema";
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
  Bell,
  Megaphone,
  Settings,
  Star,
  AlertCircle,
  X,
  Flame,
  Zap,
  Leaf,
  Activity,
  Droplets,
  Sun,
  Wind,
  LucideIcon,
} from "lucide-react";

const HERO_ICON_MAP: Record<string, LucideIcon> = {
  Waves,
  Crown,
  Heart,
  Users,
  Calendar,
  Sparkles,
  Shield,
  Star,
  Flame,
  Zap,
  Leaf,
  Activity,
  Droplets,
  Sun,
  Wind,
  Clock,
};

function HeroSubFeatureIcon({ name }: { name: string }) {
  const IconComponent = HERO_ICON_MAP[name] ?? Sparkles;
  return <IconComponent className="h-8 w-8 text-primary" />;
}

// Gallery Carousel Component
function GalleryCarousel({ images, title, subtitle }: { images: GalleryImage[]; title?: string; subtitle?: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(0);

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  // Update selected index on scroll
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Reinitialize carousel when images change or load
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
  }, [emblaApi, images, imagesLoaded]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Handle image load events
  const handleImageLoad = useCallback(() => {
    setImagesLoaded(prev => prev + 1);
  }, []);

  return (
    <section className="py-16 px-4 bg-gradient-to-br from-muted/30 to-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-4">
            {title || "Our Wellness Space"}
          </h2>
          <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto">
            {subtitle || "Step inside Wolf Mother Wellness and discover a sanctuary designed for relaxation and rejuvenation."}
          </p>
        </div>

        <div className="relative">
          {/* Carousel Container */}
          <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="flex-[0_0_100%] min-w-0 md:flex-[0_0_50%] lg:flex-[0_0_33.333%] px-2"
                >
                  <div className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                    <div 
                      className="overflow-hidden"
                      style={{ aspectRatio: (image.aspectRatio || "4:3").replace(':', '/') }}
                    >
                      <img
                        src={image.imageUrl}
                        alt={image.altText || image.title}
                        className="w-full h-full transform group-hover:scale-110 transition-transform duration-500"
                        style={{ objectFit: (image.objectFit || "cover") as any }}
                        onLoad={handleImageLoad}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={scrollPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground rounded-full p-3 shadow-lg transition-all duration-200 z-10"
            aria-label="Previous image"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground rounded-full p-3 shadow-lg transition-all duration-200 z-10"
            aria-label="Next image"
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          {/* Dot Indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === selectedIndex
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

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

  // Fetch gallery images
  const { data: galleryImages } = useQuery<GalleryImage[]>({
    queryKey: ["/api/gallery-images"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gallery-images");
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
        address: data.find((s: any) => s.key === 'address')?.value || '',
        addressLine2: data.find((s: any) => s.key === 'addressLine2')?.value || '',
        copyrightYear: data.find((s: any) => s.key === 'copyrightYear')?.value || '2025',
        instagramHandle: data.find((s: any) => s.key === 'instagramHandle')?.value || 'wolfmothertulsa',
        tagline: data.find((s: any) => s.key === 'tagline')?.value || '',
      };
    },
  });

  // Day order for sorting (Sunday first, Saturday last)
  const dayOrder: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // Fetch weekly hours of operation
  const { data: weeklyHours } = useQuery({
    queryKey: ["/api/hours-of-operation"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hours-of-operation");
      const hours = await res.json();
      // Sort by day of week
      return hours.sort((a: any, b: any) => {
        const dayA = dayOrder[a.dayOfWeek?.toLowerCase()] ?? 7;
        const dayB = dayOrder[b.dayOfWeek?.toLowerCase()] ?? 7;
        return dayA - dayB;
      });
    },
  });

  // Helper to group consecutive days with identical hours
  const groupHours = (hours: any[]) => {
    if (!hours || hours.length === 0) return [];
    
    const dayAbbrev: Record<string, string> = {
      sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
      thursday: 'Thu', friday: 'Fri', saturday: 'Sat'
    };
    
    const result: Array<{ days: string; memberHours: string; dayPassHours: string; isClosed: boolean }> = [];
    let startDay = '';
    let endDay = '';
    let lastMemberHours = '';
    let lastDayPassHours = '';
    let lastIsClosed = false;
    
    const pushGroup = () => {
      if (startDay) {
        result.push({
          days: startDay === endDay ? startDay : `${startDay} - ${endDay}`,
          memberHours: lastMemberHours,
          dayPassHours: lastDayPassHours,
          isClosed: lastIsClosed
        });
      }
    };
    
    hours.forEach((day: any, index: number) => {
      const abbrev = dayAbbrev[day.dayOfWeek?.toLowerCase()] || day.dayOfWeek;
      const memberHours = day.isClosed ? 'Closed' : `${day.openTime} - ${day.closeTime}`;
      const dayPassHours = day.isClosed ? 'Closed' : (day.dayPassStart && day.dayPassEnd ? `${day.dayPassStart} - ${day.dayPassEnd}` : 'Not available');
      
      if (index === 0) {
        startDay = abbrev;
        endDay = abbrev;
        lastMemberHours = memberHours;
        lastDayPassHours = dayPassHours;
        lastIsClosed = day.isClosed;
      } else if (memberHours === lastMemberHours && dayPassHours === lastDayPassHours) {
        endDay = abbrev;
      } else {
        pushGroup();
        startDay = abbrev;
        endDay = abbrev;
        lastMemberHours = memberHours;
        lastDayPassHours = dayPassHours;
        lastIsClosed = day.isClosed;
      }
    });
    
    pushGroup();
    return result;
  };

  const groupedHours = weeklyHours ? groupHours(weeklyHours) : [];

  // Fetch session configurations
  const { data: sessionConfigs } = useQuery<SessionConfig[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
  });

  // Fetch day pass hours
  const { data: dayPassHoursConfig } = useQuery<DayPassHours>({
    queryKey: ["/api/day-pass-hours"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/day-pass-hours");
      return res.json();
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
        subFeature1Icon: data.find((s: any) => s.key === 'subFeature1Icon')?.value ?? 'Waves',
        subFeature1Title: data.find((s: any) => s.key === 'subFeature1Title')?.value ?? 'Thermal Facilities',
        subFeature1Description: data.find((s: any) => s.key === 'subFeature1Description')?.value ?? 'Access to sauna, hot tubs, cold plunge and more',
        subFeature2Icon: data.find((s: any) => s.key === 'subFeature2Icon')?.value ?? 'Heart',
        subFeature2Title: data.find((s: any) => s.key === 'subFeature2Title')?.value ?? 'Wellness Guides',
        subFeature2Description: data.find((s: any) => s.key === 'subFeature2Description')?.value ?? 'Expert guidance for thermal therapy',
        subFeature3Icon: data.find((s: any) => s.key === 'subFeature3Icon')?.value ?? 'Users',
        subFeature3Title: data.find((s: any) => s.key === 'subFeature3Title')?.value ?? 'Flexible Plans',
        subFeature3Description: data.find((s: any) => s.key === 'subFeature3Description')?.value ?? 'Choose a plan that fits your needs',
      };
    },
  });

  // Fetch features content
  const { data: featuresContent } = useQuery({
    queryKey: ["/api/landing-content/features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/features");
      const data = await res.json();
      return {
        sectionTitle: data.find((s: any) => s.key === 'sectionTitle')?.value || '',
        items: [
          { title: data.find((s: any) => s.key === 'feature1Title')?.value || '', description: data.find((s: any) => s.key === 'feature1Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'feature2Title')?.value || '', description: data.find((s: any) => s.key === 'feature2Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'feature3Title')?.value || '', description: data.find((s: any) => s.key === 'feature3Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'feature4Title')?.value || '', description: data.find((s: any) => s.key === 'feature4Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'feature5Title')?.value || '', description: data.find((s: any) => s.key === 'feature5Description')?.value || '' },
        ].filter(f => f.title),
      };
    },
  });

  // Fetch benefits content
  const { data: benefitsContent } = useQuery({
    queryKey: ["/api/landing-content/benefits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/benefits");
      const data = await res.json();
      return {
        sectionTitle: data.find((s: any) => s.key === 'sectionTitle')?.value || '',
        items: [
          { title: data.find((s: any) => s.key === 'benefit1Title')?.value || '', description: data.find((s: any) => s.key === 'benefit1Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'benefit2Title')?.value || '', description: data.find((s: any) => s.key === 'benefit2Description')?.value || '' },
          { title: data.find((s: any) => s.key === 'benefit3Title')?.value || '', description: data.find((s: any) => s.key === 'benefit3Description')?.value || '' },
        ],
      };
    },
  });

  // Fetch memberships section content
  const { data: membershipsContent } = useQuery({
    queryKey: ["/api/landing-content/memberships"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/memberships");
      const data = await res.json();
      return {
        title: data.find((s: any) => s.key === 'title')?.value || '',
        subtitle: data.find((s: any) => s.key === 'subtitle')?.value || '',
        membershipColumnTitle: data.find((s: any) => s.key === 'membershipColumnTitle')?.value || '',
        membershipColumnSubtitle: data.find((s: any) => s.key === 'membershipColumnSubtitle')?.value || '',
        dayPassColumnTitle: data.find((s: any) => s.key === 'dayPassColumnTitle')?.value || '',
        dayPassColumnSubtitle: data.find((s: any) => s.key === 'dayPassColumnSubtitle')?.value || '',
      };
    },
  });

  // Fetch gallery section content
  const { data: galleryContent } = useQuery({
    queryKey: ["/api/landing-content/gallery"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/gallery");
      const data = await res.json();
      return {
        title: data.find((s: any) => s.key === 'title')?.value || '',
        subtitle: data.find((s: any) => s.key === 'subtitle')?.value || '',
      };
    },
  });

  // Fetch FAQ section heading content
  const { data: faqSectionContent } = useQuery({
    queryKey: ["/api/landing-content/faq"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/faq");
      const data = await res.json();
      return {
        title: data.find((s: any) => s.key === 'title')?.value || '',
        subtitle: data.find((s: any) => s.key === 'subtitle')?.value || '',
      };
    },
  });

  // Fetch CTA section content
  const { data: ctaContent } = useQuery({
    queryKey: ["/api/landing-content/cta"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/cta");
      const data = await res.json();
      return {
        title: data.find((s: any) => s.key === 'title')?.value || '',
        subtitle: data.find((s: any) => s.key === 'subtitle')?.value || '',
        primaryButtonText: data.find((s: any) => s.key === 'primaryButtonText')?.value || '',
        secondaryButtonText: data.find((s: any) => s.key === 'secondaryButtonText')?.value || '',
      };
    },
  });

  // Fetch FAQ items
  const { data: faqItems } = useQuery<{ id: number; question: string; answer: string; category?: string }[]>({
    queryKey: ["/api/faq-items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/faq-items");
      return await res.json();
    },
  });

  // FAQ accordion state
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  // Fetch active notifications
  const { data: activeNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/active"],
  });

  // Track dismissed and expanded notifications
  const [dismissedNotifications, setDismissedNotifications] = useState<number[]>([]);
  const [expandedNotifications, setExpandedNotifications] = useState<number[]>([]);

  const dismissNotification = (id: number) => {
    setDismissedNotifications(prev => [...prev, id]);
  };

  const toggleExpanded = (id: number) => {
    setExpandedNotifications(prev => 
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const visibleNotifications = activeNotifications?.filter(
    n => !dismissedNotifications.includes(n.id)
  ) || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone className="h-5 w-5" />;
      case 'maintenance': return <Settings className="h-5 w-5" />;
      case 'promotion': return <Star className="h-5 w-5" />;
      case 'alert': return <AlertCircle className="h-5 w-5" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'maintenance': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'promotion': return 'bg-green-50 border-green-200 text-green-800';
      case 'alert': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

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
    <Sparkles className="h-8 w-8 text-primary" />,
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

      {/* Notification Banner */}
      {visibleNotifications.length > 0 && (
        <div className="w-full">
          {visibleNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`relative border-b px-4 py-3 ${getNotificationStyle(notification.type)}`}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 pr-14 sm:pr-0">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-sm opacity-90 line-clamp-1">{notification.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="flex-shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading-display text-foreground mb-4">
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

          {/* Hero Sub-Feature Cards */}
          {heroContent && (heroContent.subFeature1Title || heroContent.subFeature2Title || heroContent.subFeature3Title) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-3xl mx-auto">
              {[
                { icon: heroContent.subFeature1Icon, title: heroContent.subFeature1Title, description: heroContent.subFeature1Description },
                { icon: heroContent.subFeature2Icon, title: heroContent.subFeature2Title, description: heroContent.subFeature2Description },
                { icon: heroContent.subFeature3Icon, title: heroContent.subFeature3Title, description: heroContent.subFeature3Description },
              ].filter(f => f.title).map((feature, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-white/70 backdrop-blur-sm shadow-sm px-5 py-6 text-center hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
                  <div className="rounded-full bg-primary/10 p-3">
                    <HeroSubFeatureIcon name={feature.icon} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground text-sm leading-tight mb-1">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground font-body leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Membership & Day Pass Marketing Cards */}
      <section className="py-20 px-4 bg-gradient-to-br from-background to-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-foreground mb-4">
              {membershipsContent?.title || "Choose your path to wellness."}
            </h2>
            <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto">
              {membershipsContent?.subtitle || "Choose a membership or day pass to start your thermal wellness experience. Come relax with us."}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            {/* Membership Plans Section */}
            <div>
              <div className="text-center mb-8">
                <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-heading font-bold text-foreground mb-2">
                  {membershipsContent?.membershipColumnTitle || "Monthly Memberships"}
                </h3>
                <p className="text-muted-foreground font-body">
                  {membershipsContent?.membershipColumnSubtitle || "Access to all amenities, including special events."}
                </p>
              </div>

              <div className="space-y-5">
                {membershipPlans?.filter((plan: MembershipPlan) => plan.isActive && plan.availableOnWebsite !== false).map((plan: MembershipPlan) => (
                  <Card
                    key={plan.id}
                    className="overflow-hidden border-2 hover:border-primary/30 hover:shadow-xl transition-all duration-300"
                  >
                    {/* Accent bar */}
                    <div className={`h-1.5 w-full ${plan.planType === 'premium' ? 'bg-gradient-to-r from-violet-500 to-primary' : 'bg-gradient-to-r from-primary/60 to-primary'}`} />

                    <CardContent className="p-5 sm:p-6">
                      {/* Plan type + price row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            {plan.planType === 'premium' ? (
                              <Badge className="bg-violet-100 text-violet-700 border border-violet-200 text-xs uppercase tracking-wide">
                                <Crown className="h-3 w-3 mr-1" />
                                Premium
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                                Membership
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-lg sm:text-xl font-heading font-bold text-foreground leading-tight">
                            {plan.name}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-bold text-primary leading-none">
                            {formatPrice(plan.monthlyPrice)}
                          </div>
                          <div className="text-xs text-muted-foreground font-body mt-0.5">
                            per month
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {plan.description && (
                        <p className="text-sm text-muted-foreground font-body mb-4 leading-relaxed">
                          {plan.description}
                        </p>
                      )}

                      {/* Availability badge */}
                      {formatAvailabilityDates(plan.availableFrom, plan.availableUntil) && (
                        <div className="mb-4">
                          <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatAvailabilityDates(plan.availableFrom, plan.availableUntil)}
                          </Badge>
                        </div>
                      )}

                      {/* Feature checklist */}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="space-y-2 mb-4">
                          {plan.features.map((feature: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-body">{feature.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Standard benefit badges */}
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        <Badge className="bg-primary/10 text-primary border-0 text-xs">
                          <Waves className="h-3 w-3 mr-1" />
                          All Thermal Facilities
                        </Badge>
                        <Badge className="bg-primary/10 text-primary border-0 text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Cancel Anytime
                        </Badge>
                      </div>

                      <Link href="/auth?tab=register">
                        <Button className="w-full wellness-button-primary">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Get Started
                        </Button>
                      </Link>
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
                  {membershipsContent?.dayPassColumnTitle || "Day Pass Packages"}
                </h3>
                <p className="text-muted-foreground font-body">
                  {membershipsContent?.dayPassColumnSubtitle || "Perfect for trying our facilities or occasional visits"}
                </p>
              </div>

              <div className="space-y-5">
                {dayPasses?.filter((dayPass: any) => dayPass.isActive && dayPass.availableOnWebsite !== false).map((dayPass: any, index: number) => (
                  <Card
                    key={index}
                    className="overflow-hidden border-2 hover:border-primary/30 hover:shadow-xl transition-all duration-300"
                  >
                    {/* Accent bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-500/70" />

                    <CardContent className="p-5 sm:p-6">
                      {/* Badge row + price */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          {/* badgeText from DB, or auto badge for value packages */}
                          {(dayPass.badgeText || dayPass.totalPunches >= 10) && (
                            <div className="mb-1.5">
                              {dayPass.badgeText ? (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold">
                                  <Star className="h-3 w-3 mr-1" />
                                  {dayPass.badgeText}
                                </Badge>
                              ) : dayPass.totalPunches >= 20 ? (
                                <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs font-semibold">
                                  <Heart className="h-3 w-3 mr-1" />
                                  Best Value
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Popular
                                </Badge>
                              )}
                            </div>
                          )}
                          <h4 className="text-lg sm:text-xl font-heading font-bold text-foreground leading-tight">
                            {dayPass.name}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-bold text-primary leading-none">
                            {formatPrice(dayPass.totalPrice)}
                          </div>
                          <div className="text-xs text-muted-foreground font-body mt-0.5">
                            {formatPrice(dayPass.pricePerPunch)} / visit
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {dayPass.description && (
                        <p className="text-sm text-muted-foreground font-body mb-4 leading-relaxed">
                          {dayPass.description}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        <Badge className="bg-secondary/80 text-secondary-foreground border-0 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {dayPass.totalPunches} {dayPass.totalPunches === 1 ? 'Visit' : 'Visits'}
                        </Badge>
                        <Badge className="bg-secondary/80 text-secondary-foreground border-0 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          No Expiration
                        </Badge>
                        <Badge className="bg-secondary/80 text-secondary-foreground border-0 text-xs">
                          <Waves className="h-3 w-3 mr-1" />
                          All Facilities
                        </Badge>
                      </div>

                      <Link href="/auth?tab=register">
                        <Button
                          variant="outline"
                          className="w-full border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Purchase Package
                        </Button>
                      </Link>
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
                {benefitsContent?.sectionTitle || "Why Choose Wolf Mother Wellness"}
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {benefitsContent?.items?.map((benefit, index) => (
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

      {/* Gallery Carousel Section */}
      {galleryImages && galleryImages.length > 0 && (
        <GalleryCarousel
          images={galleryImages}
          title={galleryContent?.title}
          subtitle={galleryContent?.subtitle}
        />
      )}

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
            {featuresContent?.sectionTitle || "Core Experience"}
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuresContent?.items?.map((feature, index) => (
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

      {/* FAQ Section */}
      {faqItems && faqItems.length > 0 && (
        <section className="py-16 px-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-heading font-bold text-foreground mb-4">
                {faqSectionContent?.title || "Frequently Asked Questions"}
              </h2>
              <p className="text-xl text-muted-foreground font-body">
                {faqSectionContent?.subtitle || "Everything you need to know about Wolf Mother Wellness"}
              </p>
            </div>

            <div className="space-y-4">
              {faqItems.map((faq) => (
                <div
                  key={faq.id}
                  className="border rounded-lg overflow-hidden bg-card"
                >
                  <button
                    onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-semibold text-foreground">{faq.question}</span>
                    <ArrowRight
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                        openFaqId === faq.id ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                  {openFaqId === faq.id && (
                    <div className="px-6 pb-4 text-muted-foreground font-body leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-20 px-4 bg-primary text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-heading font-bold mb-6">
            {ctaContent?.title || "Ready to get started?"}
          </h2>
          <p className="text-xl mb-8 text-white/90 font-body">
            {ctaContent?.subtitle || "Choose a plan and begin your wellness experience."}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/auth?tab=register">
              <Button
                size="lg"
                className="bg-white text-neutral-900 hover:bg-gray-100 px-10 py-6 text-xl font-bold shadow-2xl border-3 border-white hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
              >
                <CheckCircle className="h-6 w-6 mr-3" />
                {ctaContent?.primaryButtonText || "Start Your Journey"}
              </Button>
            </Link>

            <Link href="/auth?tab=login">
              <Button
                variant="outline"
                size="lg"
                className="border-4 border-white text-white bg-transparent hover:bg-white hover:text-neutral-900 px-10 py-6 text-xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                {ctaContent?.secondaryButtonText || "Log In to View Plans"}
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
                {footerSettings?.address}
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
              © {footerSettings?.copyrightYear} Wolf Mother Wellness.{footerSettings?.tagline ? ` ${footerSettings.tagline}` : " Where legends are born and wellness thrives."}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
