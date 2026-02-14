import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GiftCardDenomination } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Gift, CreditCard, Package, Loader2, ArrowLeft, CheckCircle, Search } from "lucide-react";
import { Link } from "wouter";

export default function GiftCardsPage() {
  const { toast } = useToast();
  const [selectedDenom, setSelectedDenom] = useState<GiftCardDenomination | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchasedCode, setPurchasedCode] = useState("");

  const [checkCode, setCheckCode] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const { data: denominations, isLoading } = useQuery<GiftCardDenomination[]>({
    queryKey: ["/api/gift-card-denominations"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/gift-cards/purchase", data);
      return res.json();
    },
    onSuccess: (data) => {
      setPurchaseComplete(true);
      setPurchasedCode(data.giftCard.code);
      toast({ title: "Gift Card Purchased!", description: "An email has been sent to the recipient." });
    },
    onError: (error: any) => {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePurchase = () => {
    if (!selectedDenom || !recipientName || !recipientEmail || !purchaserName || !purchaserEmail) {
      toast({ title: "Missing Info", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    purchaseMutation.mutate({
      denominationId: selectedDenom.id,
      recipientEmail,
      recipientName,
      personalMessage: personalMessage || undefined,
      purchaserName,
      purchaserEmail,
    });
  };

  const handleCheckBalance = async () => {
    if (!checkCode.trim()) return;
    setIsChecking(true);
    try {
      const res = await apiRequest("GET", `/api/gift-cards/check/${checkCode.trim()}`);
      const data = await res.json();
      setCheckResult(data);
    } catch (err: any) {
      setCheckResult(null);
      toast({ title: "Not Found", description: "Gift card code not found or invalid.", variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  };

  const monetaryDenoms = denominations?.filter(d => d.type === 'monetary') || [];
  const bundleDenoms = denominations?.filter(d => d.type === 'day_pass_bundle') || [];

  if (purchaseComplete) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-green-50 dark:bg-green-950 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Gift Card Sent!</h1>
          <p className="text-muted-foreground mb-6">
            Your gift card has been emailed to {recipientEmail}. They'll receive the code and instructions to redeem it.
          </p>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Gift Card Code</p>
              <code className="text-2xl font-mono font-bold tracking-wider">{purchasedCode}</code>
            </CardContent>
          </Card>
          <div className="flex gap-4 justify-center">
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
            <Button onClick={() => {
              setPurchaseComplete(false);
              setSelectedDenom(null);
              setRecipientName("");
              setRecipientEmail("");
              setPersonalMessage("");
              setPurchaserName("");
              setPurchaserEmail("");
            }}>
              Buy Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Gift Cards</h1>
          <p className="text-muted-foreground mt-2">
            Give the gift of wellness. Choose a gift card or day pass bundle to send to someone special.
          </p>
        </div>

        {!selectedDenom ? (
          <div className="space-y-8">
            {monetaryDenoms.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Gift Cards
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {monetaryDenoms.map(denom => (
                    <Card
                      key={denom.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setSelectedDenom(denom)}
                    >
                      <CardContent className="pt-6 text-center">
                        <div className="bg-gradient-to-br from-[#4a5d4a] to-[#6b8e5a] text-white rounded-lg p-6 mb-4">
                          <p className="text-sm opacity-80">Wolf Mother Wellness</p>
                          <p className="text-3xl font-bold mt-2">${(denom.value / 100).toFixed(0)}</p>
                          <p className="text-xs opacity-70 mt-1">Gift Card</p>
                        </div>
                        <p className="font-medium">{denom.label}</p>
                        <p className="text-sm text-muted-foreground mt-1">${(denom.price / 100).toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {bundleDenoms.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5" /> Day Pass Bundles
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bundleDenoms.map(denom => (
                    <Card
                      key={denom.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setSelectedDenom(denom)}
                    >
                      <CardContent className="pt-6 text-center">
                        <div className="bg-gradient-to-br from-[#4a5d4a] to-[#6b8e5a] text-white rounded-lg p-6 mb-4">
                          <p className="text-sm opacity-80">Wolf Mother Wellness</p>
                          <p className="text-3xl font-bold mt-2">{denom.value}</p>
                          <p className="text-xs opacity-70 mt-1">Day Pass{denom.value > 1 ? 'es' : ''}</p>
                        </div>
                        <p className="font-medium">{denom.label}</p>
                        <p className="text-sm text-muted-foreground mt-1">${(denom.price / 100).toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && monetaryDenoms.length === 0 && bundleDenoms.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4" />
                  <p>Gift cards are not available at this time.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" /> Check Gift Card Balance
                </CardTitle>
                <CardDescription>Already have a gift card? Check your remaining balance.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter gift card code"
                    value={checkCode}
                    onChange={(e) => { setCheckCode(e.target.value.toUpperCase()); setCheckResult(null); }}
                    className="font-mono"
                  />
                  <Button onClick={handleCheckBalance} disabled={isChecking || !checkCode.trim()}>
                    {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                  </Button>
                </div>
                {checkResult && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {checkResult.type === 'monetary' ? 'Gift Card Balance' : 'Day Passes Remaining'}
                        </p>
                        <p className="text-2xl font-bold">
                          {checkResult.type === 'monetary' 
                            ? `$${(checkResult.remainingAmount / 100).toFixed(2)}`
                            : `${checkResult.remainingAmount} passes`}
                        </p>
                      </div>
                      <Badge variant={checkResult.status === 'active' ? 'default' : 'secondary'}>
                        {checkResult.status}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-lg mx-auto">
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedDenom(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to options
            </Button>
            
            <Card className="mb-6">
              <CardContent className="pt-6 text-center">
                <div className="bg-gradient-to-br from-[#4a5d4a] to-[#6b8e5a] text-white rounded-lg p-6 inline-block">
                  <p className="text-sm opacity-80">Wolf Mother Wellness</p>
                  <p className="text-3xl font-bold mt-2">
                    {selectedDenom.type === 'monetary'
                      ? `$${(selectedDenom.value / 100).toFixed(0)}`
                      : `${selectedDenom.value} Day Passes`}
                  </p>
                </div>
                <p className="font-medium mt-4">{selectedDenom.label}</p>
                <p className="text-sm text-muted-foreground">Price: ${(selectedDenom.price / 100).toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>Who is sending this gift card?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaserName">Your Name *</Label>
                  <Input
                    id="purchaserName"
                    value={purchaserName}
                    onChange={(e) => setPurchaserName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaserEmail">Your Email *</Label>
                  <Input
                    id="purchaserEmail"
                    type="email"
                    value={purchaserEmail}
                    onChange={(e) => setPurchaserEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipient Details</CardTitle>
                <CardDescription>Who should receive this gift card?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient Name *</Label>
                  <Input
                    id="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Their name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="their@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (optional)</Label>
                  <Textarea
                    id="message"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    placeholder="Enjoy your wellness experience!"
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handlePurchase} 
                  disabled={purchaseMutation.isPending || !recipientName || !recipientEmail || !purchaserName || !purchaserEmail}
                  className="w-full"
                  size="lg"
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Purchase for ${(selectedDenom.price / 100).toFixed(2)}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  The gift card code will be emailed to the recipient immediately after purchase.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
