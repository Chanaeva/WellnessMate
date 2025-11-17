import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ShoppingCart, ArrowLeft, Search, User, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  size: string | null;
  quantityTotal: number;
  quantityAvailable: number;
  isActive: boolean;
  description: string | null;
};

type MemberSearchResult = {
  id: number;
  username: string;
  email: string;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  membership?: {
    membershipId: string;
    status: string;
    planType: string;
  };
};

type ItemCheckout = {
  id: number;
  itemId: number;
  userId: number;
  checkedOutAt: string;
  checkedInAt: string | null;
  status: string;
  notes: string | null;
  item?: InventoryItem;
  user?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
};

export default function StaffItems() {
  const [activeTab, setActiveTab] = useState("checkout");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkinDialog, setCheckinDialog] = useState<ItemCheckout | null>(null);
  const [checkinNotes, setCheckinNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/staff/inventory/items'],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<MemberSearchResult[]>({
    queryKey: ['/api/staff/search-members', debouncedSearchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/staff/search-members?query=${encodeURIComponent(debouncedSearchTerm)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to search members');
      }
      return response.json();
    },
    enabled: debouncedSearchTerm.length >= 2,
  });

  const { data: activeCheckouts = [], isLoading: checkoutsLoading } = useQuery<ItemCheckout[]>({
    queryKey: ['/api/staff/checkouts/active'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { itemId: number; userId: number; notes?: string }) => {
      const response = await apiRequest("POST", "/api/staff/checkouts", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Checked Out",
        description: "Item has been checked out successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/inventory/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
      setSelectedMember(null);
      setSelectedItemId("");
      setCheckoutNotes("");
      setSearchTerm("");
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Unable to checkout item",
        variant: "destructive",
      });
    }
  });

  const checkinMutation = useMutation({
    mutationFn: async (data: { id: number; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/staff/checkouts/${data.id}/checkin`, {
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Checked In",
        description: "Item has been returned successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/inventory/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/checkouts/active'] });
      setCheckinDialog(null);
      setCheckinNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Checkin Failed",
        description: error.message || "Unable to checkin item",
        variant: "destructive",
      });
    }
  });

  const handleCheckout = () => {
    if (!selectedMember || !selectedItemId) {
      toast({
        title: "Missing Information",
        description: "Please select both a member and an item",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate({
      itemId: parseInt(selectedItemId),
      userId: selectedMember.id,
      notes: checkoutNotes || undefined
    });
  };

  const handleCheckin = () => {
    if (!checkinDialog) return;
    
    checkinMutation.mutate({
      id: checkinDialog.id,
      notes: checkinNotes || undefined
    });
  };

  const availableItems = items.filter(item => item.isActive && item.quantityAvailable > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-8 w-8" />
              Item Checkout
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage robes, shoes, and other items for members
            </p>
          </div>
          <Link href="/staff/check-in">
            <Button variant="outline" data-testid="button-back-to-checkin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Check-in
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checkout" data-testid="tab-checkout">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Checkout Item
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active-checkouts">
              <Package className="h-4 w-4 mr-2" />
              Active Checkouts ({activeCheckouts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkout" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Checkout Item to Member</CardTitle>
                <CardDescription>
                  Search for a member and select an item to checkout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="member-search">Search Member</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="member-search"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-member-search"
                    />
                  </div>

                  {selectedMember && (
                    <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-8 w-8 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white" data-testid="text-selected-member-name">
                                {selectedMember.firstName} {selectedMember.lastName}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {selectedMember.email}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedMember(null)}
                            data-testid="button-clear-member"
                          >
                            Clear
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {searchResults && searchResults.length > 0 && !selectedMember && (
                    <Card>
                      <CardContent className="p-0">
                        <div className="max-h-64 overflow-y-auto">
                          {searchResults.map((member) => (
                            <button
                              key={member.id}
                              onClick={() => {
                                setSelectedMember(member);
                                setSearchTerm("");
                              }}
                              className="w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-b-0 transition-colors"
                              data-testid={`button-select-member-${member.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {member.firstName} {member.lastName}
                                  </p>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {member.email}
                                  </p>
                                </div>
                                {member.membership && (
                                  <Badge variant={member.membership.status === 'active' ? 'default' : 'secondary'}>
                                    {member.membership.planType}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-select">Select Item</Label>
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger id="item-select" data-testid="select-item">
                      <SelectValue placeholder="Choose an item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()} data-testid={`select-item-option-${item.id}`}>
                          {item.name} {item.size && `(${item.size})`} - {item.quantityAvailable} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-notes">Notes (Optional)</Label>
                  <Textarea
                    id="checkout-notes"
                    placeholder="Add any notes about this checkout..."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    rows={3}
                    data-testid="textarea-checkout-notes"
                  />
                </div>

                <Button 
                  onClick={handleCheckout}
                  disabled={!selectedMember || !selectedItemId || checkoutMutation.isPending}
                  className="w-full"
                  data-testid="button-checkout-item"
                >
                  {checkoutMutation.isPending ? "Checking Out..." : "Checkout Item"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Checkouts</CardTitle>
                <CardDescription>
                  Items currently checked out to members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checkoutsLoading ? (
                  <div className="text-center py-8 text-slate-500" data-testid="text-loading">
                    Loading checkouts...
                  </div>
                ) : activeCheckouts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500" data-testid="text-no-checkouts">
                    No active checkouts
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Checked Out</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCheckouts.map((checkout) => (
                          <TableRow key={checkout.id} data-testid={`row-checkout-${checkout.id}`}>
                            <TableCell className="font-medium">
                              {checkout.item?.name} {checkout.item?.size && `(${checkout.item.size})`}
                            </TableCell>
                            <TableCell>
                              {checkout.user?.firstName} {checkout.user?.lastName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Calendar className="h-4 w-4" />
                                {new Date(checkout.checkedOutAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {checkout.notes || "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setCheckinDialog(checkout);
                                  setCheckinNotes("");
                                }}
                                data-testid={`button-checkin-${checkout.id}`}
                              >
                                Check In
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!checkinDialog} onOpenChange={(open) => !open && setCheckinDialog(null)}>
        <DialogContent data-testid="dialog-checkin">
          <DialogHeader>
            <DialogTitle>Check In Item</DialogTitle>
            <DialogDescription>
              Confirm checking in {checkinDialog?.item?.name} from {checkinDialog?.user?.firstName} {checkinDialog?.user?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-notes">Return Notes (Optional)</Label>
              <Textarea
                id="checkin-notes"
                placeholder="Add any notes about the return condition..."
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                rows={3}
                data-testid="textarea-checkin-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCheckinDialog(null)}
              data-testid="button-cancel-checkin"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCheckin}
              disabled={checkinMutation.isPending}
              data-testid="button-confirm-checkin"
            >
              {checkinMutation.isPending ? "Checking In..." : "Confirm Check In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
