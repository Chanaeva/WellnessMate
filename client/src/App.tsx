import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import MemberDashboard from "@/pages/member-dashboard";
import QRCodePage from "@/pages/qr-code-page";
import MembershipPage from "@/pages/membership-page";
import PaymentsPage from "@/pages/payments-page";
import AdminDashboard from "@/pages/admin/dashboard";
import StaffCheckIn from "@/pages/staff-checkin";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin-login" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Member routes */}
      <ProtectedRoute path="/" component={MemberDashboard} />
      <ProtectedRoute path="/qr-code" component={QRCodePage} />
      <ProtectedRoute path="/membership" component={MembershipPage} />
      <ProtectedRoute path="/payments" component={PaymentsPage} />
      
      {/* Staff check-in - accessible to all authenticated users */}
      <ProtectedRoute path="/staff-checkin" component={StaffCheckIn} />
      
      {/* Admin routes */}
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      
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
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
