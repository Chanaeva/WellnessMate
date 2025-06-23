import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoBlack from "@assets/WM Emblem Black.png";
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
  Copy
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

  const features = [
    {
      icon: <Waves className="h-8 w-8 text-primary" />,
      title: "Sacred Thermal Waters",
      description: "Ancient healing pools with mineral-rich waters from the depths of the earth"
    },
    {
      icon: <Crown className="h-8 w-8 text-primary" />,
      title: "VIP Roman Experience",
      description: "Luxurious amenities inspired by ancient Roman thermal baths"
    },
    {
      icon: <Heart className="h-8 w-8 text-primary" />,
      title: "Wellness Sanctuary",
      description: "Complete mind-body restoration in our peaceful environment"
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Community of Wolves",
      description: "Join our pack of wellness warriors on the journey to vitality"
    }
  ];



  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10"></div>
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <img 
              src={logoBlack} 
              alt="Wolf Mother Wellness" 
              className="h-24 w-24 object-contain"
            />
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading text-foreground mb-4">
            Wolf Mother Wellness
          </h1>
          
          <p className="text-lg font-body text-muted-foreground mb-2">
            Thermal Wellness Center
          </p>
          
          <Badge className="mb-8 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            Now Open in Ancient Lupus Valley
          </Badge>
          
          <p className="text-xl md:text-2xl mb-12 text-foreground/80 max-w-3xl mx-auto leading-relaxed font-body">
            Where ancient Roman thermal wisdom meets modern wellness. Step into the sacred waters 
            that nurtured Romulus and Remus, and discover your inner strength.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-medium">
                <Crown className="h-5 w-5 mr-2" />
                Join the Pack
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            
            <Link to="/auth">
              <Button variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/5 px-8 py-4 text-lg font-medium">
                Member Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Promotions Carousel */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-12 text-foreground">
            Exclusive Promotions
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {promotions?.map((promo, index) => (
              <Card key={index} className="border-0 shadow-lg transform hover:scale-105 transition-transform duration-300 bg-primary text-white">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading font-bold">{promo.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg mb-4 opacity-90 font-body">{promo.description}</p>
                  <div className="bg-white/20 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium font-body">Promo Code:</p>
                    <p className="text-xl font-bold font-mono">{promo.code}</p>
                  </div>
                  <p className="text-sm opacity-75 font-body">{promo.validUntil}</p>
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
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-background">
                <CardContent className="pt-8 pb-6">
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-heading font-semibold mb-3 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-body">{feature.description}</p>
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
            Join the Wolf Mother pack today and discover the ancient path to vitality
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-medium">
                <CheckCircle className="h-5 w-5 mr-2" />
                Start Your Journey
              </Button>
            </Link>
            
            <Link to="/auth">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-medium">
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
              <h3 className="font-heading font-semibold text-foreground mb-2">Visit Us</h3>
              <p className="text-muted-foreground font-body">2124 E Admiral<br />Tulsa, OK</p>
            </div>
            
            <div className="flex flex-col items-center">
              <Phone className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">Call Us</h3>
              <p className="text-muted-foreground font-body">(555) WOLF-MOM<br />Available 24/7</p>
            </div>
            
            <div className="flex flex-col items-center">
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-2">Hours</h3>
              <p className="text-muted-foreground font-body">Daily: 5:00 AM - 11:00 PM<br />Sacred Waters Never Sleep</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-foreground text-background">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted font-body">
            © 2025 Wolf Mother Wellness. Where legends are born and wellness thrives.
          </p>
        </div>
      </footer>
    </div>
  );
}