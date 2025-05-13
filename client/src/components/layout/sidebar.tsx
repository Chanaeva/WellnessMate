import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  QrCode, 
  Calendar, 
  CreditCard, 
  FileText, 
  Settings,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className }: SidebarProps) => {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    {
      title: "Dashboard",
      href: "/admin",
      icon: <LayoutDashboard className="h-5 w-5" />
    },
    {
      title: "Members",
      href: "/admin/members",
      icon: <Users className="h-5 w-5" />
    },
    {
      title: "Check-ins",
      href: "/admin/check-ins",
      icon: <QrCode className="h-5 w-5" />
    },
    {
      title: "Classes",
      href: "/admin/classes",
      icon: <Calendar className="h-5 w-5" />
    },
    {
      title: "Billing",
      href: "/admin/billing",
      icon: <CreditCard className="h-5 w-5" />
    },
    {
      title: "Reports",
      href: "/admin/reports",
      icon: <FileText className="h-5 w-5" />
    },
    {
      title: "Settings",
      href: "/admin/settings",
      icon: <Settings className="h-5 w-5" />
    }
  ];

  return (
    <div className={cn("bg-white rounded-xl shadow-md overflow-hidden sticky top-24", className)}>
      <div className="p-4 bg-neutral-dark text-white">
        <h3 className="font-heading font-semibold">Admin Controls</h3>
      </div>
      <div className="p-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "bg-primary text-white"
                      : "text-neutral-dark hover:bg-neutral-light"
                  )}
                >
                  {item.icon}
                  <span className="ml-3">{item.title}</span>
                </a>
              </Link>
            );
          })}
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-500"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span>Sign Out</span>
          </Button>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
