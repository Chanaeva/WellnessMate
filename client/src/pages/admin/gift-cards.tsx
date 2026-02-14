import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GiftCard, GiftCardDenomination } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Gift, Search, Plus, Edit, Loader2, DollarSign, 
  ChevronLeft, ChevronRight, Eye, CreditCard, Package,
  Copy, Check
} from "lucide-react";

export default function AdminGiftCards() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("issued");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "monetary" as "monetary" | "day_pass_bundle",
    initialAmount: "",
    purchaserEmail: "",
    purchaserName: "",
    recipientEmail: "",
    recipientName: "",
    personalMessage: "",
  });

  const [denomDialogOpen, setDenomDialogOpen] = useState(false);
  const [editingDenom, setEditingDenom] = useState<GiftCardDenomination | null>(null);
  const [denomForm, setDenomForm] = useState({
    type: "monetary" as "monetary" | "day_pass_bundle",
    label: "",
    value: "",
    price: "",
    isActive: true,
    sortOrder: 0,
  });

  const [viewingCard, setViewingCard] = useState<GiftCard | null>(null);

  const searchParams = new URLSearchParams({
    page: currentPage.toString(),
    pageSize: pageSize.toString(),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(searchTerm ? { search: searchTerm } : {}),
  });

  const { data: giftCardsData, isLoading: isLoadingCards } = useQuery<{ data: GiftCard[]; total: number }>({
    queryKey: [`/api/admin/gift-cards?${searchParams}`],
    staleTime: 30 * 1000,
  });

  const { data: denominations, isLoading: isLoadingDenoms } = useQuery<GiftCardDenomination[]>({
    queryKey: ["/api/admin/gift-card-denominations"],
  });

  const { data: cardDetail } = useQuery<any>({
    queryKey: ["/api/admin/gift-cards", viewingCard?.id],
    enabled: !!viewingCard,
  });
  const redemptions = cardDetail?.redemptions;

  const createGiftCardMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/gift-cards", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-cards"] });
      toast({ title: "Gift Card Created", description: `Code: ${data.code}` });
      setCreateDialogOpen(false);
      setCreateForm({
        type: "monetary",
        initialAmount: "",
        purchaserEmail: "",
        purchaserName: "",
        recipientEmail: "",
        recipientName: "",
        personalMessage: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGiftCardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/gift-cards/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-cards"] });
      toast({ title: "Gift Card Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createDenomMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/gift-card-denominations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-card-denominations"] });
      toast({ title: "Denomination Created" });
      setDenomDialogOpen(false);
      resetDenomForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDenomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/gift-card-denominations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-card-denominations"] });
      toast({ title: "Denomination Updated" });
      setDenomDialogOpen(false);
      setEditingDenom(null);
      resetDenomForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteDenomMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/gift-card-denominations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-card-denominations"] });
      toast({ title: "Denomination Deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetDenomForm = () => {
    setDenomForm({ type: "monetary", label: "", value: "", price: "", isActive: true, sortOrder: 0 });
  };

  const handleCreateGiftCard = () => {
    const amount = createForm.type === "monetary"
      ? Math.round(parseFloat(createForm.initialAmount) * 100)
      : parseInt(createForm.initialAmount);
    
    if (!amount || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    createGiftCardMutation.mutate({
      type: createForm.type,
      initialAmount: amount,
      remainingAmount: amount,
      purchaserEmail: createForm.purchaserEmail,
      purchaserName: createForm.purchaserName,
      recipientEmail: createForm.recipientEmail,
      recipientName: createForm.recipientName,
      personalMessage: createForm.personalMessage || undefined,
    });
  };

  const handleSaveDenom = () => {
    const value = denomForm.type === "monetary"
      ? Math.round(parseFloat(denomForm.value) * 100)
      : parseInt(denomForm.value);
    const price = Math.round(parseFloat(denomForm.price) * 100);

    if (!value || !price) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    const data = {
      type: denomForm.type,
      label: denomForm.label,
      value,
      price,
      isActive: denomForm.isActive,
      sortOrder: denomForm.sortOrder,
    };

    if (editingDenom) {
      updateDenomMutation.mutate({ id: editingDenom.id, data });
    } else {
      createDenomMutation.mutate(data);
    }
  };

  const startEditDenom = (denom: GiftCardDenomination) => {
    setEditingDenom(denom);
    setDenomForm({
      type: denom.type as "monetary" | "day_pass_bundle",
      label: denom.label,
      value: denom.type === "monetary" ? (denom.value / 100).toString() : denom.value.toString(),
      price: (denom.price / 100).toString(),
      isActive: denom.isActive,
      sortOrder: denom.sortOrder,
    });
    setDenomDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatAmount = (card: GiftCard) => {
    if (card.type === "monetary") {
      return `$${(card.remainingAmount / 100).toFixed(2)} / $${(card.initialAmount / 100).toFixed(2)}`;
    }
    return `${card.remainingAmount} / ${card.initialAmount} passes`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      redeemed: "secondary",
      expired: "destructive",
      disabled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const totalPages = Math.ceil((giftCardsData?.total || 0) / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gift Cards</h2>
        <p className="text-muted-foreground">
          Manage gift cards, day pass bundles, and denomination options.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="issued" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Issued Cards
          </TabsTrigger>
          <TabsTrigger value="denominations" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Denominations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issued" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, email, or name..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10 w-full sm:w-[300px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="redeemed">Redeemed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Gift Card
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Gift Card</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={createForm.type} onValueChange={(v: "monetary" | "day_pass_bundle") => setCreateForm({ ...createForm, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monetary">Monetary Gift Card</SelectItem>
                        <SelectItem value="day_pass_bundle">Day Pass Bundle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{createForm.type === "monetary" ? "Amount ($)" : "Number of Day Passes"}</Label>
                    <Input
                      type="number"
                      value={createForm.initialAmount}
                      onChange={(e) => setCreateForm({ ...createForm, initialAmount: e.target.value })}
                      placeholder={createForm.type === "monetary" ? "25.00" : "5"}
                      min={createForm.type === "monetary" ? "0.01" : "1"}
                      step={createForm.type === "monetary" ? "0.01" : "1"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Purchaser Name</Label>
                      <Input
                        value={createForm.purchaserName}
                        onChange={(e) => setCreateForm({ ...createForm, purchaserName: e.target.value })}
                        placeholder="Staff / In-store"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Purchaser Email</Label>
                      <Input
                        value={createForm.purchaserEmail}
                        onChange={(e) => setCreateForm({ ...createForm, purchaserEmail: e.target.value })}
                        placeholder="staff@example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Recipient Name</Label>
                      <Input
                        value={createForm.recipientName}
                        onChange={(e) => setCreateForm({ ...createForm, recipientName: e.target.value })}
                        placeholder="Recipient name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recipient Email</Label>
                      <Input
                        value={createForm.recipientEmail}
                        onChange={(e) => setCreateForm({ ...createForm, recipientEmail: e.target.value })}
                        placeholder="recipient@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Personal Message (optional)</Label>
                    <Textarea
                      value={createForm.personalMessage}
                      onChange={(e) => setCreateForm({ ...createForm, personalMessage: e.target.value })}
                      placeholder="Enjoy your wellness experience!"
                      rows={2}
                    />
                  </div>
                  <Button onClick={handleCreateGiftCard} disabled={createGiftCardMutation.isPending} className="w-full">
                    {createGiftCardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                    Create Gift Card
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingCards ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {giftCardsData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No gift cards found
                        </TableCell>
                      </TableRow>
                    ) : (
                      giftCardsData?.data?.map((card) => (
                        <TableRow key={card.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{card.code}</code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyCode(card.code)}
                              >
                                {copiedCode === card.code ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {card.type === "monetary" ? (
                                <><CreditCard className="h-3 w-3 mr-1" /> Monetary</>
                              ) : (
                                <><Package className="h-3 w-3 mr-1" /> Day Passes</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatAmount(card)}</TableCell>
                          <TableCell>{getStatusBadge(card.status)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{card.recipientName}</div>
                              <div className="text-muted-foreground text-xs">{card.recipientEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(card.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingCard(card)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {card.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateGiftCardMutation.mutate({ id: card.id, data: { status: "disabled" } })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, giftCardsData?.total || 0)} of {giftCardsData?.total || 0}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="denominations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Gift Card Denominations</h3>
              <p className="text-sm text-muted-foreground">Configure the gift card options available for purchase.</p>
            </div>
            <Dialog open={denomDialogOpen} onOpenChange={(open) => { setDenomDialogOpen(open); if (!open) { setEditingDenom(null); resetDenomForm(); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingDenom(null); resetDenomForm(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Denomination
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingDenom ? "Edit Denomination" : "Add Denomination"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={denomForm.type} onValueChange={(v: "monetary" | "day_pass_bundle") => setDenomForm({ ...denomForm, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monetary">Monetary Gift Card</SelectItem>
                        <SelectItem value="day_pass_bundle">Day Pass Bundle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={denomForm.label}
                      onChange={(e) => setDenomForm({ ...denomForm, label: e.target.value })}
                      placeholder={denomForm.type === "monetary" ? "$25 Gift Card" : "5-Day Pass Bundle"}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{denomForm.type === "monetary" ? "Value ($)" : "Number of Passes"}</Label>
                      <Input
                        type="number"
                        value={denomForm.value}
                        onChange={(e) => setDenomForm({ ...denomForm, value: e.target.value })}
                        placeholder={denomForm.type === "monetary" ? "25.00" : "5"}
                        min="0"
                        step={denomForm.type === "monetary" ? "0.01" : "1"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        value={denomForm.price}
                        onChange={(e) => setDenomForm({ ...denomForm, price: e.target.value })}
                        placeholder="25.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={denomForm.isActive}
                      onCheckedChange={(checked) => setDenomForm({ ...denomForm, isActive: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input
                      type="number"
                      value={denomForm.sortOrder}
                      onChange={(e) => setDenomForm({ ...denomForm, sortOrder: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <Button onClick={handleSaveDenom} disabled={createDenomMutation.isPending || updateDenomMutation.isPending} className="w-full">
                    {(createDenomMutation.isPending || updateDenomMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingDenom ? "Update" : "Create"} Denomination
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingDenoms ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {denominations?.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Gift className="h-12 w-12 mb-4" />
                    <p>No denominations configured yet.</p>
                    <p className="text-sm">Add denominations to let customers purchase gift cards.</p>
                  </CardContent>
                </Card>
              ) : (
                denominations?.map((denom) => (
                  <Card key={denom.id} className={!denom.isActive ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{denom.label}</CardTitle>
                        <Badge variant={denom.isActive ? "default" : "secondary"}>
                          {denom.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <CardDescription>
                        {denom.type === "monetary" ? (
                          <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Monetary</span>
                        ) : (
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" /> Day Pass Bundle</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {denom.type === "monetary" ? "Value:" : "Passes:"}
                        </span>
                        <span className="font-medium">
                          {denom.type === "monetary" ? `$${(denom.value / 100).toFixed(2)}` : `${denom.value} day passes`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-medium">${(denom.price / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => startEditDenom(denom)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteDenomMutation.mutate(denom.id)}
                          disabled={deleteDenomMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingCard} onOpenChange={(open) => { if (!open) setViewingCard(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gift Card Details</DialogTitle>
          </DialogHeader>
          {viewingCard && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono bg-muted px-3 py-2 rounded">{viewingCard.code}</code>
                {getStatusBadge(viewingCard.status)}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">{viewingCard.type === "monetary" ? "Monetary" : "Day Pass Bundle"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance</span>
                  <p className="font-medium">{formatAmount(viewingCard)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Purchaser</span>
                  <p className="font-medium">{viewingCard.purchaserName}</p>
                  <p className="text-xs text-muted-foreground">{viewingCard.purchaserEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipient</span>
                  <p className="font-medium">{viewingCard.recipientName}</p>
                  <p className="text-xs text-muted-foreground">{viewingCard.recipientEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{new Date(viewingCard.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email Sent</span>
                  <p className="font-medium">{viewingCard.emailSent ? "Yes" : "No"}</p>
                </div>
              </div>
              {viewingCard.personalMessage && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Message</span>
                  <p className="mt-1 bg-muted p-3 rounded italic">"{viewingCard.personalMessage}"</p>
                </div>
              )}
              {redemptions && redemptions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Redemption History</h4>
                  <div className="space-y-2">
                    {redemptions.map((r: any) => (
                      <div key={r.id} className="flex justify-between text-sm bg-muted p-2 rounded">
                        <span>{r.description}</span>
                        <span className="font-medium">
                          {viewingCard.type === "monetary" ? `$${(r.amount / 100).toFixed(2)}` : `${r.amount} passes`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {viewingCard.status === "active" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      updateGiftCardMutation.mutate({ id: viewingCard.id, data: { status: "disabled" } });
                      setViewingCard(null);
                    }}
                  >
                    Disable Card
                  </Button>
                )}
                {viewingCard.status === "disabled" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      updateGiftCardMutation.mutate({ id: viewingCard.id, data: { status: "active" } });
                      setViewingCard(null);
                    }}
                  >
                    Re-enable Card
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
