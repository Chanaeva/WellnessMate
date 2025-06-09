import { Link } from "wouter";
import { Facebook, Twitter, Instagram, Mail } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 py-6 mt-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white font-bold mr-2">
                WW
              </div>
              <span className="text-sm text-gray-600">
                © {currentYear} WolfMother Wellness - Thermal Wellness Center. All rights reserved.
              </span>
            </div>
          </div>
          <div className="flex space-x-4">
            <a href="https://www.instagram.com/wolfmothertulsa" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-primary" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-600 hover:text-primary" aria-label="Facebook">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-600 hover:text-primary" aria-label="Twitter">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="mailto:info@wolfmothertulsa.com" className="text-gray-600 hover:text-primary" aria-label="Email">
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>
        <div className="mt-4 text-center">
          <div className="flex flex-wrap justify-center space-x-4 text-xs text-gray-500">
            <Link href="#">
              <a className="hover:text-primary">Terms of Service</a>
            </Link>
            <Link href="#">
              <a className="hover:text-primary">Privacy Policy</a>
            </Link>
            <Link href="#">
              <a className="hover:text-primary">Contact Us</a>
            </Link>
            <Link href="#">
              <a className="hover:text-primary">FAQ</a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
