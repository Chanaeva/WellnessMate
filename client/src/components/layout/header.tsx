import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Menu, X, ChevronDown, User, Settings, LogOut } from "lucide-react";

const Header = () => {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  
  const getInitials = () => {
    if (!user) return "?";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navLinks = isAdmin ? [
    { href: "/admin", label: "Dashboard", active: location === "/admin" },
    { href: "/admin/members", label: "Members", active: location === "/admin/members" },
    { href: "/admin/check-ins", label: "Check-ins", active: location === "/admin/check-ins" }
  ] : [
    { href: "/", label: "Dashboard", active: location === "/" },
    { href: "/thermal-treatments", label: "Thermal Treatments", active: location === "/thermal-treatments" },
    { href: "/qr-code", label: "My QR Code", active: location === "/qr-code" },
    { href: "/membership", label: "Membership", active: location === "/membership" },
    { href: "/payments", label: "Payments", active: location === "/payments" }
  ];

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href={isAdmin ? '/admin' : '/'}>
              <a className="flex items-center">
                <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                  WW
                </div>
                <div className="ml-2">
                  <h1 className="text-xl font-heading font-semibold text-neutral-dark">WolfMother Wellness</h1>
                  <p className="text-xs text-neutral-dark opacity-70">Thermal Wellness Center</p>
                </div>
              </a>
            </Link>
          </div>
          
          <div className="hidden md:flex space-x-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <a className={`text-neutral-dark hover:text-primary px-3 py-2 ${link.active ? 'font-medium text-primary' : ''}`}>
                  {link.label}
                </a>
              </Link>
            ))}
          </div>
          
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 focus:outline-none">
                  <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                    {getInitials()}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">
                    {user ? `${user.firstName} ${user.lastName}` : "User"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>View Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-500" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <a 
                    className={`text-neutral-dark hover:text-primary px-3 py-2 ${link.active ? 'font-medium text-primary' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
