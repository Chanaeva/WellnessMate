import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/hooks/use-cart";
import { AudioProvider } from "@/hooks/use-audio";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import MemberDashboard from "@/pages/member-dashboard";
import QRCodePage from "@/pages/qr-code-page";


import PackagesPage from "@/pages/packages-page";
import CheckoutPage from "@/pages/checkout-page";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminMembers from "@/pages/admin/members";
import AdminNotifications from "@/pages/admin/notifications";
import AdminMembershipPlans from "@/pages/admin-membership-plans";
import AdminLandingPageManager from "@/pages/admin/landing-page-manager";
import StaffCheckIn from "@/pages/staff-checkin";
import TestPayment from "@/pages/test-payment";


function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin-login" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Member routes */}
      <ProtectedRoute path="/dashboard" component={MemberDashboard} />
      <ProtectedRoute path="/qr-code" component={QRCodePage} />


      <ProtectedRoute path="/packages" component={PackagesPage} />
      <ProtectedRoute path="/checkout" component={CheckoutPage} />
      
      {/* Test payment - accessible to all authenticated users */}
      <ProtectedRoute path="/test-payment" component={TestPayment} />

      {/* Staff check-in - accessible to all authenticated users */}
      <ProtectedRoute path="/staff-checkin" component={StaffCheckIn} />
      
      {/* Admin routes */}
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/admin/members" component={AdminMembers} />
      <ProtectedRoute path="/admin/notifications" component={AdminNotifications} />
      <ProtectedRoute path="/admin/membership-plans" component={AdminMembershipPlans} />
      <ProtectedRoute path="/admin/landing-page" component={AdminLandingPageManager} />
      
      {/* Landing page as default */}
      <Route path="/" component={LandingPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <AudioProvider>
              <Router />
              <Toaster />
            </AudioProvider>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
