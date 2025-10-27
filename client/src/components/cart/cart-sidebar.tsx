import { useCart } from "@/hooks/use-cart";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Minus, Trash2, Tag, X } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface CartSidebarProps {
  trigger?: React.ReactNode;
}

export function CartSidebar({ trigger }: CartSidebarProps) {
  const { 
    items, 
    promoCode,
    removeItem, 
    updateQuantity, 
    getTotalPrice, 
    getSubtotal,
    getDiscount,
    getItemCount, 
    clearCart, 
    applyPromoCode,
    removePromoCode,
    setCartOpenCallback 
  } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const { toast } = useToast();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a promo code",
        variant: "destructive",
      });
      return;
    }

    setIsApplyingPromo(true);
    try {
      const res = await apiRequest("POST", "/api/validate-promo-code", {
        code: promoInput.trim(),
      });

      if (!res.ok) {
        const error = await res.json();
        toast({
          title: "Invalid Promo Code",
          description: error.message || "This promo code is not valid",
          variant: "destructive",
        });
        return;
      }

      const promo = await res.json();
      applyPromoCode(promo);
      setPromoInput("");
      toast({
        title: "Promo Code Applied!",
        description: `${promo.title} - ${promo.description}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to apply promo code",
        variant: "destructive",
      });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    removePromoCode();
    toast({
      title: "Promo Code Removed",
      description: "The promo code has been removed from your cart",
    });
  };

  // Set up cart open callback
  useEffect(() => {
    setCartOpenCallback(() => () => setIsOpen(true));
    return () => setCartOpenCallback(null);
  }, [setCartOpenCallback]);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="relative">
      <ShoppingCart className="h-4 w-4 mr-2" />
      Cart
      {getItemCount() > 0 && (
        <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
          {getItemCount()}
        </Badge>
      )}
    </Button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart ({getItemCount()})
          </SheetTitle>
          <SheetDescription>
            Review your selected plans and packages
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add some plans or packages to get started
              </p>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type === 'membership' ? 'Monthly Plan' : 'Day Passes'}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {formatPrice(item.price)}
                            {item.type === 'membership' && '/month'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {item.type === 'punch_card' && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                          disabled={(item.quantity || 1) <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              {/* Promo Code Section */}
              <div className="space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Promo Code
                </div>
                
                {promoCode ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <Tag className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-green-700">
                        {promoCode.code}
                      </div>
                      <div className="text-xs text-green-600">
                        {promoCode.title}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleRemovePromo}
                      data-testid="button-remove-promo"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                      className="text-sm"
                      data-testid="input-promo-code"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplyPromo}
                      disabled={isApplyingPromo}
                      data-testid="button-apply-promo"
                    >
                      {isApplyingPromo ? "..." : "Apply"}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Cart Summary */}
              <div className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatPrice(getSubtotal())}</span>
                  </div>
                  {promoCode && getDiscount() > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({promoCode.code}):</span>
                      <span>-{formatPrice(getDiscount())}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-lg">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>

                <div className="space-y-2">
                  <Link href="/checkout">
                    <Button className="w-full wellness-button-primary" data-testid="button-checkout">
                      Proceed to Checkout
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={clearCart}
                    data-testid="button-clear-cart"
                  >
                    Clear Cart
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Secure checkout powered by Stripe
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}