import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Droplet, Flame, Snowflake, Wind, Clock, Users, ChevronRight } from "lucide-react";

export default function ThermalTreatmentsPage() {
  const { user } = useAuth();
  
  const treatmentCategories = [
    {
      id: "heat",
      name: "Heat Therapies",
      icon: <Flame className="h-5 w-5 text-primary" />,
      description: "Traditional and modern heat treatments"
    },
    {
      id: "cold",
      name: "Cold Therapies",
      icon: <Snowflake className="h-5 w-5 text-blue-500" />,
      description: "Invigorating cold immersion experiences"
    },
    {
      id: "contrast",
      name: "Contrast Therapy",
      icon: <Droplet className="h-5 w-5 text-purple-500" />,
      description: "Alternating hot and cold treatments"
    },
    {
      id: "steam",
      name: "Steam Therapies",
      icon: <Wind className="h-5 w-5 text-teal-500" />,
      description: "Humid heat experiences for deep relaxation"
    }
  ];

  const treatments = {
    heat: [
      {
        name: "Finnish Sauna",
        duration: "30-45 min",
        description: "Traditional dry heat sauna experience with temperatures of 80-100°C (175-212°F), promoting relaxation, improved circulation, and detoxification.",
        benefits: ["Improves circulation", "Relieves muscle tension", "Promotes detoxification", "Enhances recovery"],
        capacity: "8 people",
        image: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      },
      {
        name: "Infrared Sauna",
        duration: "30-45 min",
        description: "Modern sauna using infrared technology that heats the body directly rather than heating the air. Operates at lower temperatures (50-60°C) while providing deep tissue penetration.",
        benefits: ["Deep tissue heating", "Joint pain relief", "Improved skin tone", "Lower stress levels"],
        capacity: "3 people",
        image: "https://images.unsplash.com/photo-1610851467736-58efdac27be3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      }
    ],
    cold: [
      {
        name: "Cold Plunge Pool",
        duration: "1-3 min",
        description: "Immersion in 5-10°C (41-50°F) water that triggers vasoconstriction, stimulates the nervous system, and provides myriad health benefits when used properly.",
        benefits: ["Reduces inflammation", "Improves recovery time", "Increases alertness", "Stimulates immune system"],
        capacity: "4 people",
        image: "https://images.unsplash.com/photo-1613725193525-2fd537614b3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      },
      {
        name: "Cryotherapy Chamber",
        duration: "2-3 min",
        description: "Brief exposure to extremely cold air (-110°C to -140°C) in a specialized chamber, providing whole-body cold therapy benefits in a short duration.",
        benefits: ["Rapid recovery", "Pain management", "Reduced soreness", "Enhanced mood"],
        capacity: "1 person",
        image: "https://images.unsplash.com/photo-1532246420286-a0af5f7d6995?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      }
    ],
    contrast: [
      {
        name: "Nordic Cycle",
        duration: "30-60 min",
        description: "Alternating between hot sauna (15 min) and cold immersion (1-3 min) for 2-3 cycles, finishing with a rest period. This traditional practice offers powerful health benefits.",
        benefits: ["Enhanced circulation", "Immune system boost", "Improved mood", "Stress reduction"],
        capacity: "Group session",
        image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      },
      {
        name: "Kneipp Therapy",
        duration: "15-20 min",
        description: "Walking through alternating pools of warm and cold water to stimulate circulation in the legs and feet, based on the 19th century naturopathic techniques.",
        benefits: ["Improves foot circulation", "Reduces swelling", "Reinvigorates tired legs", "Strengthens immunity"],
        capacity: "4 people",
        image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      }
    ],
    steam: [
      {
        name: "Steam Room",
        duration: "10-20 min",
        description: "Moist heat environment (40-45°C) with nearly 100% humidity, opening pores, improving breathing, and providing deep relaxation.",
        benefits: ["Opens respiratory passages", "Cleanses skin", "Loosens tight muscles", "Increases flexibility"],
        capacity: "10 people",
        image: "https://images.unsplash.com/photo-1595939592301-7cf8bdbc838e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      },
      {
        name: "Turkish Hammam",
        duration: "45-60 min",
        description: "Traditional Middle Eastern bathing ritual featuring warm marble surfaces, steam, and optional scrub treatments for deep cleansing and relaxation.",
        benefits: ["Deep cleansing", "Exfoliation", "Toxin removal", "Stress reduction"],
        capacity: "Group session",
        image: "https://images.unsplash.com/photo-1586529726010-33ca336c7ee8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      }
    ]
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Thermal Wellness Treatments</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Experience our scientifically designed thermal treatments to improve health, recovery, and well-being through the therapeutic effects of temperature.
            </p>
          </div>
          
          <Tabs defaultValue="heat" className="mb-8">
            <TabsList className="grid grid-cols-4 mb-8">
              {treatmentCategories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="flex items-center">
                  <span className="mr-2">{category.icon}</span>
                  <span className="hidden md:inline">{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {Object.entries(treatments).map(([key, items]) => (
              <TabsContent key={key} value={key} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((treatment, index) => (
                    <Card key={index} className="overflow-hidden">
                      <div className="h-48 overflow-hidden">
                        <img 
                          src={treatment.image} 
                          alt={treatment.name} 
                          className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{treatment.name}</CardTitle>
                            <CardDescription className="flex items-center mt-1">
                              <Clock className="h-4 w-4 mr-1" /> {treatment.duration}
                              <span className="mx-2">•</span>
                              <Users className="h-4 w-4 mr-1" /> {treatment.capacity}
                            </CardDescription>
                          </div>
                          <Button variant="outline" className="rounded-full px-3 py-1 h-8 text-xs">Book Now</Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 mb-4">{treatment.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {treatment.benefits.map((benefit, i) => (
                            <Badge key={i} variant="outline" className="bg-primary/5 text-primary">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="md:w-1/4 flex justify-center">
                  <div className="bg-primary/10 text-primary p-6 rounded-full">
                    <Droplet className="h-12 w-12" />
                  </div>
                </div>
                <div className="md:w-3/4 text-center md:text-left">
                  <h3 className="text-xl font-bold mb-2">Schedule a Personalized Thermal Wellness Consultation</h3>
                  <p className="text-gray-600 mb-4">
                    Not sure which thermal treatments are right for you? Our thermal wellness experts can create a 
                    personalized protocol based on your health goals and preferences.
                  </p>
                  <Button className="bg-primary hover:bg-primary/90">
                    Book Consultation <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
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