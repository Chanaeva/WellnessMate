import { useLocation } from 'wouter';
import { XCircle, ArrowLeft, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

export default function CheckoutCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Checkout Cancelled
          </h1>
          <p className="text-lg text-muted-foreground">
            Your payment was cancelled. No charges were made to your account.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center pb-4">
            <CardTitle>What Happened?</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You cancelled the checkout process or closed the payment window. 
              Your cart items are still saved and ready for checkout when you're ready.
            </p>
          </CardContent>
        </Card>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-amber-900 mb-2">Need Help?</h3>
          <ul className="space-y-2 text-amber-800 text-sm">
            <li>• If you experienced technical issues, please try again</li>
            <li>• Contact our support team if you need assistance</li>
            <li>• Your cart items are saved and waiting for you</li>
            <li>• No payment information was processed or stored</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => setLocation('/checkout')}
            className="wellness-button-primary"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Return to Checkout
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation('/packages')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Browse Packages
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}