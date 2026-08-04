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
import AdminLogin from "@/pages/admin-login";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import ClaimAccountPage from "@/pages/claim-account";
import MemberDashboard from "@/pages/member-dashboard";

import PackagesPage from "@/pages/packages-page";
import CheckoutPage from "@/pages/checkout-page";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminMembers from "@/pages/admin/members";
import AdminNotifications from "@/pages/admin/notifications";
import AdminMembershipPlans from "@/pages/admin-membership-plans";
import LandingPageManagement from "@/pages/admin/landing-page";
import AdminStaffManagement from "@/pages/admin/staff-management";
import AdminInventory from "@/pages/admin/inventory";
import AdminSessions from "@/pages/admin/sessions";
import AdminSessionBookings from "@/pages/admin/session-bookings";
import AdminGallery from "@/pages/admin/gallery";
import AdminCheckIns from "@/pages/admin/check-ins";
import GiftCardsPage from "@/pages/gift-cards";

import GuestWaiverPage from "@/pages/guest-waiver";
import KioskCheckIn from "@/pages/kiosk-checkin";
import KioskMemberCreation from "@/pages/kiosk-member-creation";
import MembershipAgreement from "@/pages/membership-agreement";
import StaffCheckIn from "@/pages/staff-checkin";
import StaffItems from "@/pages/staff-items";
import AdminSetup from "@/pages/admin-setup";
import SetPassword from "@/pages/set-password";
import { useLocation } from "wouter";

function KioskMemberCreationWrapper() {
  const [, setLocation] = useLocation();
  
  const handleBack = () => {
    setLocation("/kiosk");
  };
  
  const handleSuccess = () => {
    setLocation("/kiosk");
  };
  
  return <KioskMemberCreation onBack={handleBack} onSuccess={handleSuccess} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/setup" component={AdminSetup} />
      <ProtectedRoute path="/membership-agreement" component={MembershipAgreement} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/claim-account" component={ClaimAccountPage} />
      <ProtectedRoute path="/set-password" component={SetPassword} />
      
      {/* Member routes */}
      <ProtectedRoute path="/dashboard" component={MemberDashboard} />

      <Route path="/gift-cards" component={GiftCardsPage} />
      <Route path="/packages" component={PackagesPage} />
      <ProtectedRoute path="/checkout" component={CheckoutPage} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/cancel" component={CheckoutCancel} />
      

      {/* Staff check-in - accessible to all authenticated users */}
      <ProtectedRoute path="/staff-checkin" component={StaffCheckIn} />
      <ProtectedRoute path="/staff/check-in" component={StaffCheckIn} />
      <ProtectedRoute path="/staff/items" component={StaffItems} />
      
      {/* Admin routes */}
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <ProtectedRoute path="/admin/members" component={AdminMembers} />
      <ProtectedRoute path="/admin/notifications" component={AdminNotifications} />
      <ProtectedRoute path="/admin/membership-plans" component={AdminMembershipPlans} />
      <ProtectedRoute path="/admin/landing-page" component={LandingPageManagement} />
      <ProtectedRoute path="/admin/staff-management" component={AdminStaffManagement} />
      <ProtectedRoute path="/admin/inventory" component={AdminInventory} />
      <ProtectedRoute path="/admin/sessions" component={AdminSessions} />
      <ProtectedRoute path="/admin/session-bookings" component={AdminSessionBookings} />
      <ProtectedRoute path="/admin/gallery" component={AdminGallery} />
      <ProtectedRoute path="/admin/check-ins" component={AdminCheckIns} />

      <Route path="/waiver" component={GuestWaiverPage} />
      <Route path="/kiosk" component={KioskCheckIn} />
      <Route path="/kiosk-checkin" component={KioskCheckIn} />
      <Route path="/kiosk/member-creation" component={KioskMemberCreationWrapper} />
      
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
