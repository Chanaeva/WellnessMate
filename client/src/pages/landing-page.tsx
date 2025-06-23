import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Clock
} from "lucide-react";

export default function LandingPage() {
  const [currentPromo, setCurrentPromo] = useState(0);

  const promotions = [
    {
      title: "New Member Special",
      description: "50% off your first month",
      code: "WOLFPACK50",
      validUntil: "End of June 2025",
      bgColor: "bg-gradient-to-r from-amber-500 to-orange-600",
      textColor: "text-white"
    },
    {
      title: "Student Discount",
      description: "25% off all memberships",
      code: "STUDENT25",
      validUntil: "Valid with student ID",
      bgColor: "bg-gradient-to-r from-blue-500 to-purple-600",
      textColor: "text-white"
    },
    {
      title: "Family Package",
      description: "Add family members for just $30/month",
      code: "FAMILY30",
      validUntil: "Up to 4 additional members",
      bgColor: "bg-gradient-to-r from-green-500 to-teal-600",
      textColor: "text-white"
    }
  ];

  const features = [
    {
      icon: <Waves className="h-8 w-8 text-blue-600" />,
      title: "Sacred Thermal Waters",
      description: "Ancient healing pools with mineral-rich waters from the depths of the earth"
    },
    {
      icon: <Crown className="h-8 w-8 text-amber-600" />,
      title: "VIP Roman Experience",
      description: "Luxurious amenities inspired by ancient Roman thermal baths"
    },
    {
      icon: <Heart className="h-8 w-8 text-red-500" />,
      title: "Wellness Sanctuary",
      description: "Complete mind-body restoration in our peaceful environment"
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: "Community of Wolves",
      description: "Join our pack of wellness warriors on the journey to vitality"
    }
  ];



  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-gradient-to-br from-amber-500/10 to-orange-500/10"></div>
        </div>
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <Badge className="mb-6 bg-amber-500/20 text-amber-200 border-amber-400/30">
            <Sparkles className="h-4 w-4 mr-2" />
            Now Open in Ancient Lupus Valley
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">
            Wolf Mother Wellness
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Where ancient Roman thermal wisdom meets modern wellness. Step into the sacred waters 
            that nurtured Romulus and Remus, and discover your inner strength.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 text-lg">
                <Crown className="h-5 w-5 mr-2" />
                Join the Pack
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            
            <Link to="/auth">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg">
                Member Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Promotions Carousel */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-slate-800">
            Exclusive Promotions
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {promotions.map((promo, index) => (
              <Card key={index} className={`${promo.bgColor} ${promo.textColor} border-0 shadow-lg transform hover:scale-105 transition-transform duration-300`}>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">{promo.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg mb-4 opacity-90">{promo.description}</p>
                  <div className="bg-black/20 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium">Promo Code:</p>
                    <p className="text-xl font-bold font-mono">{promo.code}</p>
                  </div>
                  <p className="text-sm opacity-75">{promo.validUntil}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-slate-800">
            Sacred Wellness Experience
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardContent className="pt-8 pb-6">
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-slate-800">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>



      {/* Call to Action */}
      <section className="py-20 px-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Begin Your Wellness Journey?
          </h2>
          <p className="text-xl mb-8 text-slate-300">
            Join the Wolf Mother pack today and discover the ancient path to vitality
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 px-8 py-4 text-lg">
                <CheckCircle className="h-5 w-5 mr-2" />
                Start Your Journey
              </Button>
            </Link>
            
            <Link to="/auth">
              <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg">
                Login to View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-12 px-4 bg-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <MapPin className="h-8 w-8 text-slate-600 mb-3" />
              <h3 className="font-semibold text-slate-800 mb-2">Visit Us</h3>
              <p className="text-slate-600">Ancient Lupus Valley<br />Sacred Waters District</p>
            </div>
            
            <div className="flex flex-col items-center">
              <Phone className="h-8 w-8 text-slate-600 mb-3" />
              <h3 className="font-semibold text-slate-800 mb-2">Call Us</h3>
              <p className="text-slate-600">(555) WOLF-MOM<br />Available 24/7</p>
            </div>
            
            <div className="flex flex-col items-center">
              <Clock className="h-8 w-8 text-slate-600 mb-3" />
              <h3 className="font-semibold text-slate-800 mb-2">Hours</h3>
              <p className="text-slate-600">Daily: 5:00 AM - 11:00 PM<br />Sacred Waters Never Sleep</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-400">
            © 2025 Wolf Mother Wellness. Where legends are born and wellness thrives.
          </p>
        </div>
      </footer>
    </div>
  );
}