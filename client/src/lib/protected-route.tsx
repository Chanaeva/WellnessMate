import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteComponentProps } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<RouteComponentProps>;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if trying to access admin routes without admin or staff role
  // Some admin routes are accessible to staff (check-ins, inventory)
  const staffAllowedAdminRoutes = ["/admin/check-ins", "/admin/inventory"];
  if (path.startsWith("/admin")) {
    const isStaffAllowed = staffAllowedAdminRoutes.some(route => path.startsWith(route));
    if (user.role !== "admin" && !(user.role === "staff" && isStaffAllowed)) {
      return (
        <Route path={path}>
          <Redirect to="/" />
        </Route>
      );
    }
  }

  // Redirect users who already completed membership agreement away from the agreement page
  if (path === "/membership-agreement" && user.membershipAgreementCompleted) {
    return (
      <Route path={path}>
        <Redirect to="/dashboard" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
