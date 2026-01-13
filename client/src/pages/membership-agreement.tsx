import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield,
  Heart,
  AlertTriangle,
  FileText,
  Camera,
  Scale,
  CheckCircle,
  ArrowRight,
  Calendar,
  Phone,
  MapPin,
} from "lucide-react";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";

interface MembershipAgreementData {
  // Member Information
  emergencyContact: string;
  emergencyPhone: string;
  dateOfBirth: string;
  address: string;

  // Membership Type
  membershipType: "essential" | "celestial";

  // Health Acknowledgments
  medicalClearance: boolean;
  consultedProvider: boolean;
  understandsRisks: boolean;
  notPregnant: boolean;
  noHealthConditions: boolean;

  // Legal Agreements
  voluntaryParticipation: boolean;
  assumptionOfRisk: boolean;
  releaseOfClaims: boolean;

  // Facility Rules
  followRules: boolean;
  respectfulBehavior: boolean;

  // Privacy and Photography
  marketingConsent: boolean;
  privacyAcknowledgment: boolean;

  // Emergency Consent
  emergencyMedicalConsent: boolean;

  // Final Agreement
  readAndUnderstood: boolean;
  voluntarySignature: boolean;
  ageConfirmation: boolean;
}

export default function MembershipAgreement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Format user's DOB from database format (YYYY-MM-DD) to display format (MM/DD/YYYY)
  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    // The database stores dates in YYYY-MM-DD format, convert to MM/DD/YYYY
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[2]}/${match[3]}/${match[1]}`;
    }
    return dateStr;
  };

  const [formData, setFormData] = useState<MembershipAgreementData>({
    emergencyContact: "",
    emergencyPhone: "",
    dateOfBirth: formatDateForInput(user?.dateOfBirth),
    address: user?.address || "",
    membershipType: "essential",
    medicalClearance: false,
    consultedProvider: false,
    understandsRisks: false,
    notPregnant: false,
    noHealthConditions: false,
    voluntaryParticipation: false,
    assumptionOfRisk: false,
    releaseOfClaims: false,
    followRules: false,
    respectfulBehavior: false,
    marketingConsent: false,
    privacyAcknowledgment: false,
    emergencyMedicalConsent: false,
    readAndUnderstood: false,
    voluntarySignature: false,
    ageConfirmation: false,
  });

  const agreementMutation = useMutation({
    mutationFn: async (data: MembershipAgreementData) => {
      const res = await apiRequest("POST", "/api/membership-agreement", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Agreement Completed",
        description:
          "Welcome to Wolf Mother Wellness! You can now explore our packages.",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit agreement",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (
    field: keyof MembershipAgreementData,
    value: any,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateOfBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove all non-numeric characters
    const numbersOnly = value.replace(/\D/g, '');
    
    // Auto-format as MM/DD/YYYY
    let formatted = '';
    if (numbersOnly.length > 0) {
      formatted = numbersOnly.substring(0, 2);
    }
    if (numbersOnly.length > 2) {
      formatted += '/' + numbersOnly.substring(2, 4);
    }
    if (numbersOnly.length > 4) {
      formatted += '/' + numbersOnly.substring(4, 8);
    }
    
    handleInputChange("dateOfBirth", formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const requiredFields = [
      "emergencyContact",
      "emergencyPhone",
      "dateOfBirth",
      "address",
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof MembershipAgreementData]) {
        toast({
          title: "Missing Information",
          description: `Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate all acknowledgments are checked
    const requiredAcknowledgments = [
      "medicalClearance",
      "consultedProvider",
      "understandsRisks",
      "notPregnant",
      "noHealthConditions",
      "voluntaryParticipation",
      "assumptionOfRisk",
      "releaseOfClaims",
      "followRules",
      "respectfulBehavior",
      "privacyAcknowledgment",
      "emergencyMedicalConsent",
      "readAndUnderstood",
      "voluntarySignature",
      "ageConfirmation",
    ];

    for (const field of requiredAcknowledgments) {
      if (!formData[field as keyof MembershipAgreementData]) {
        toast({
          title: "Agreement Required",
          description:
            "You must acknowledge all terms to complete your membership",
          variant: "destructive",
        });
        return;
      }
    }

    agreementMutation.mutate(formData);
  };

  // Redirect if not logged in
  if (!user) {
    setLocation("/auth");
    return null;
  }

  // Redirect if already completed agreement
  if (user.membershipAgreementCompleted) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={logoMossGreen}
              alt="Wolf Mother Wellness"
              className="h-16 w-16 drop-shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Membership Agreement
          </h1>
          <p className="text-muted-foreground">
            Complete your Wolf Mother Wellness membership
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={`${user.firstName} ${user.lastName}`}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={user.phoneNumber || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={formData.dateOfBirth}
                    onChange={handleDateOfBirthChange}
                    maxLength={10}
                    required
                    data-testid="input-dob"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  placeholder="123 Tiber River Way, Rome"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  required
                  data-testid="input-address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContact">Emergency Contact *</Label>
                  <Input
                    id="emergencyContact"
                    placeholder="Lupus the Wise"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      handleInputChange("emergencyContact", e.target.value)
                    }
                    required
                    data-testid="input-emergency-contact"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">Emergency Phone *</Label>
                  <Input
                    id="emergencyPhone"
                    placeholder="(918) 555-WOLF"
                    value={formData.emergencyPhone}
                    onChange={(e) =>
                      handleInputChange("emergencyPhone", e.target.value)
                    }
                    required
                    data-testid="input-emergency-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Type */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                Membership Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={formData.membershipType} 
                onValueChange={(value) => handleInputChange('membershipType', value)}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="essential" id="essential" />
                  <Label htmlFor="essential" className="flex-1">
                    <div className="font-semibold">Essential ($65/month)</div>
                    <div className="text-sm text-muted-foreground">
                      Access to thermal therapy facilities, saunas, and cold plunge pools
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="celestial" id="celestial" />
                  <Label htmlFor="celestial" className="flex-1">
                    <div className="font-semibold">Celestial ($120/month)</div>
                    <div className="text-sm text-muted-foreground">
                      Premium access with additional amenities and services
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
 */}
          {/* Health and Safety */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Health and Safety Acknowledgment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-2">
                      Medical Clearance Required
                    </p>
                    <p>
                      Thermal therapy activities can be physically demanding.
                      Individuals with heart conditions, diabetes, pregnancy,
                      recent surgeries, or chronic medical conditions should
                      consult a physician before participation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="medicalClearance"
                    checked={formData.medicalClearance}
                    onCheckedChange={(checked) =>
                      handleInputChange("medicalClearance", checked)
                    }
                  />
                  <Label htmlFor="medicalClearance" className="text-sm">
                    I am in good physical health and have no medical conditions
                    that would prevent safe participation
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="consultedProvider"
                    checked={formData.consultedProvider}
                    onCheckedChange={(checked) =>
                      handleInputChange("consultedProvider", checked)
                    }
                  />
                  <Label htmlFor="consultedProvider" className="text-sm">
                    I have consulted with a healthcare provider about thermal
                    therapy (if applicable)
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="understandsRisks"
                    checked={formData.understandsRisks}
                    onCheckedChange={(checked) =>
                      handleInputChange("understandsRisks", checked)
                    }
                  />
                  <Label htmlFor="understandsRisks" className="text-sm">
                    I understand the risks associated with heat exposure and
                    cold water immersion
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="notPregnant"
                    checked={formData.notPregnant}
                    onCheckedChange={(checked) =>
                      handleInputChange("notPregnant", checked)
                    }
                  />
                  <Label htmlFor="notPregnant" className="text-sm">
                    I am not currently pregnant (if applicable)
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="noHealthConditions"
                    checked={formData.noHealthConditions}
                    onCheckedChange={(checked) =>
                      handleInputChange("noHealthConditions", checked)
                    }
                  />
                  <Label htmlFor="noHealthConditions" className="text-sm">
                    I certify that I do not have any medical conditions
                    requiring clearance, OR I have received medical clearance to
                    participate
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liability Waiver */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Assumption of Risk and Waiver
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">Important Legal Notice</p>
                    <p>
                      By participating, you assume all risks and release Wolf
                      Mother Wellness from liability for injuries or damages
                      that may occur.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="voluntaryParticipation"
                    checked={formData.voluntaryParticipation}
                    onCheckedChange={(checked) =>
                      handleInputChange("voluntaryParticipation", checked)
                    }
                  />
                  <Label htmlFor="voluntaryParticipation" className="text-sm">
                    I understand that my participation is entirely voluntary and
                    at my own risk
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="assumptionOfRisk"
                    checked={formData.assumptionOfRisk}
                    onCheckedChange={(checked) =>
                      handleInputChange("assumptionOfRisk", checked)
                    }
                  />
                  <Label htmlFor="assumptionOfRisk" className="text-sm">
                    I acknowledge and assume all risks including overheating,
                    dehydration, slips, falls, and equipment malfunctions
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="releaseOfClaims"
                    checked={formData.releaseOfClaims}
                    onCheckedChange={(checked) =>
                      handleInputChange("releaseOfClaims", checked)
                    }
                  />
                  <Label htmlFor="releaseOfClaims" className="text-sm">
                    I release Wolf Mother Wellness and SPHRSERVICES LLC from any
                    claims, demands, or causes of action arising from my
                    participation
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facility Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Scale className="h-5 w-5 mr-2" />
                Facility Rules and Conduct
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">Key Rules:</p>
                  <ul className="space-y-1 text-xs">
                    <li>
                      • Shower before entering saunas or cold plunge pools
                    </li>
                    <li>
                      • Maximum 20 minutes in saunas, 15 minutes in cold plunge
                    </li>
                    <li>
                      • No glass containers, electronics, or photography in wet
                      areas
                    </li>
                    <li>
                      • Maintain respectful behavior and appropriate noise
                      levels
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="followRules"
                    checked={formData.followRules}
                    onCheckedChange={(checked) =>
                      handleInputChange("followRules", checked)
                    }
                  />
                  <Label htmlFor="followRules" className="text-sm">
                    I agree to follow all posted safety guidelines and staff
                    instructions
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="respectfulBehavior"
                    checked={formData.respectfulBehavior}
                    onCheckedChange={(checked) =>
                      handleInputChange("respectfulBehavior", checked)
                    }
                  />
                  <Label htmlFor="respectfulBehavior" className="text-sm">
                    I will maintain respectful behavior and understand that
                    violations may result in membership termination
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy and Photography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                Privacy and Photography
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="privacyAcknowledgment"
                    checked={formData.privacyAcknowledgment}
                    onCheckedChange={(checked) =>
                      handleInputChange("privacyAcknowledgment", checked)
                    }
                  />
                  <Label htmlFor="privacyAcknowledgment" className="text-sm">
                    I understand Wolf Mother's privacy policy and consent to
                    personal information use for legitimate business purposes
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="marketingConsent"
                    checked={formData.marketingConsent}
                    onCheckedChange={(checked) =>
                      handleInputChange("marketingConsent", checked)
                    }
                  />
                  <Label htmlFor="marketingConsent" className="text-sm">
                    I consent to Wolf Mother using my likeness in promotional
                    materials (optional)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Medical Consent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Emergency Medical Consent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="emergencyMedicalConsent"
                  checked={formData.emergencyMedicalConsent}
                  onCheckedChange={(checked) =>
                    handleInputChange("emergencyMedicalConsent", checked)
                  }
                />
                <Label htmlFor="emergencyMedicalConsent" className="text-sm">
                  I consent to Wolf Mother staff calling emergency medical
                  services, contacting my emergency contact, and providing basic
                  first aid in case of emergency
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Final Agreement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                Member Acknowledgment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="readAndUnderstood"
                    checked={formData.readAndUnderstood}
                    onCheckedChange={(checked) =>
                      handleInputChange("readAndUnderstood", checked)
                    }
                  />
                  <Label
                    htmlFor="readAndUnderstood"
                    className="text-sm font-semibold"
                  >
                    I have read and understand this entire agreement
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="voluntarySignature"
                    checked={formData.voluntarySignature}
                    onCheckedChange={(checked) =>
                      handleInputChange("voluntarySignature", checked)
                    }
                  />
                  <Label
                    htmlFor="voluntarySignature"
                    className="text-sm font-semibold"
                  >
                    I am signing this agreement voluntarily
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="ageConfirmation"
                    checked={formData.ageConfirmation}
                    onCheckedChange={(checked) =>
                      handleInputChange("ageConfirmation", checked)
                    }
                  />
                  <Label
                    htmlFor="ageConfirmation"
                    className="text-sm font-semibold"
                  >
                    I am at least 18 years of age
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={agreementMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-12 py-6 text-xl font-bold"
            >
              {agreementMutation.isPending ? (
                <div className="animate-spin w-6 h-6 border-4 border-white border-t-transparent rounded-full mr-3" />
              ) : (
                <CheckCircle className="h-6 w-6 mr-3" />
              )}
              Complete Membership Agreement
              <ArrowRight className="h-6 w-6 ml-3" />
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <div className="flex items-center justify-center mb-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span>2124 E Admiral Blvd, Tulsa, OK 74105</span>
          </div>
          <p>Thank you for joining the Wolf Mother community</p>
        </div>
      </div>
    </div>
  );
}
