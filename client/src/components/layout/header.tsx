import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AudioControls } from "@/components/ui/audio-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Menu, X, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { CartSidebar } from "@/components/cart/cart-sidebar";
import logoBlack from "@assets/WM Emblem Black.png";
import logoTransparent from "@assets/WM Emblem BLK transparent.png";

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
    // Admin users only see the admin dashboard link, internal navigation handled by tabs
  ] : [
    { href: "/", label: "Dashboard", active: location === "/" },
    { href: "/qr-code", label: "My QR Code", active: location === "/qr-code" },
    { href: "/packages", label: "Plans & Packages", active: location === "/packages" }
  ];

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link href={isAdmin ? '/admin' : '/'} className="flex items-center">
              <img 
                src={logoBlack} 
                alt="Wolf Mother Wellness" 
                className="h-12 w-12 object-contain"
              />
              <div className="ml-3">
                <h1 className="text-lg sm:text-xl md:text-2xl font-heading text-foreground">Wolf Mother Wellness</h1>
                <p className="text-xs font-body text-muted-foreground">Thermal Wellness Center</p>
              </div>
            </Link>
            
            <div className="hidden md:flex space-x-4">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`text-neutral-dark hover:text-primary px-3 py-2 ${link.active ? 'font-medium text-primary' : ''}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Desktop: Show cart and user dropdown side by side */}
            <div className="hidden md:flex items-center space-x-4">
              {!isAdmin && <CartSidebar />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 focus:outline-none">
                    <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                      {getInitials()}
                    </div>
                    <span className="text-sm font-medium">
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
            </div>

            {/* Mobile: Show only user dropdown and menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-1 focus:outline-none">
                    <div className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center font-medium text-sm">
                      {getInitials()}
                    </div>
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
                onClick={toggleMobileMenu}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`text-neutral-dark hover:text-primary px-3 py-2 ${link.active ? 'font-medium text-primary' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Mobile Cart Button */}
              {!isAdmin && (
                <div className="px-3 py-2">
                  <CartSidebar />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
