import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle, Receipt, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      // Retrieve session details from Stripe
      fetch('/api/stripe/session/' + sessionId)
        .then(res => res.json())
        .then(data => {
          setSessionData(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="container mx-auto max-w-2xl px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Processing your order...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-lg text-muted-foreground">
            Thank you for your purchase. Your Wolf Mother Wellness membership is now active.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-2">
              <Receipt className="w-5 h-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionData ? (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Order ID</span>
                  <Badge variant="outline">{sessionData.id}</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Total Amount</span>
                  <span className="font-semibold">
                    ${((sessionData.amount_total || 0) / 100).toFixed(2)}
                  </span>
                </div>
                {sessionData.total_details?.amount_tax && (
                  <div className="flex justify-between items-center py-2 border-b text-sm text-muted-foreground">
                    <span>Tax Included</span>
                    <span>${(sessionData.total_details.amount_tax / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Payment Status</span>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Paid
                  </Badge>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Your order has been processed successfully. You should receive a confirmation email shortly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>• Check your email for a receipt and membership details</li>
            <li>• Visit your member dashboard to view your new membership</li>
            <li>• Generate your QR code for facility check-ins</li>
            <li>• Explore our thermal wellness facilities</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => setLocation('/dashboard')}
            className="wellness-button-primary"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation('/')}
          >
            Return Home
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}