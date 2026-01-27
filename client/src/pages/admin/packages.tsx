import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MembershipPlan, InsertMembershipPlan, PunchCardTemplate, InsertPunchCardTemplate } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, DollarSign, Crown, Star, Zap, CreditCard, Calendar, RefreshCw, AlertCircle, Monitor, ShoppingCart, Tablet, Settings } from "lucide-react";

export default function PackagesManagement() {
  const { toast } = useToast();
  
  // Max memberships per purchase state
  const [maxMemberships, setMaxMemberships] = useState<number>(4);
  const [isUpdatingMaxMemberships, setIsUpdatingMaxMemberships] = useState(false);
  
  // Membership plan state
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [planFormData, setPlanFormData] = useState<Partial<InsertMembershipPlan>>({
    planType: 'basic',
    name: '',
    monthlyPrice: 0,
    description: '',
    features: [],
    availableFrom: undefined,
    availableUntil: undefined,
    expiresAt: undefined,
    availableOnKiosk: true,
    availableOnWebsite: true,
    availableInCart: true
  });
  const [hasExpiration, setHasExpiration] = useState(false);
  const [hasAvailabilityDates, setHasAvailabilityDates] = useState(false);
  const [hasNoEndDate, setHasNoEndDate] = useState(false);

  // Punch card template state
  const [editingTemplate, setEditingTemplate] = useState<PunchCardTemplate | null>(null);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [templateFormData, setTemplateFormData] = useState<Partial<InsertPunchCardTemplate>>({
    name: '',
    totalPunches: 0,
    pricePerPunch: 0,
    totalPrice: 0,
    description: '',
    isActive: true,
    sortOrder: 0,
    availableFrom: undefined,
    availableUntil: undefined,
    availableOnKiosk: true,
    availableOnWebsite: true,
    availableInCart: true
  });
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [templateHasAvailabilityDates, setTemplateHasAvailabilityDates] = useState(false);
  const [templateHasNoEndDate, setTemplateHasNoEndDate] = useState(false);

  // Fetch max memberships per purchase setting
  const { data: maxMembershipsData } = useQuery({
    queryKey: ["/api/settings/max-memberships"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/max-memberships");
      return await res.json();
    },
  });
  
  // Sync local state when data loads
  useEffect(() => {
    if (maxMembershipsData?.maxMemberships) {
      setMaxMemberships(maxMembershipsData.maxMemberships);
    }
  }, [maxMembershipsData]);
  
  // Save max memberships setting
  const handleSaveMaxMemberships = async () => {
    setIsUpdatingMaxMemberships(true);
    try {
      await apiRequest("POST", "/api/admin/config-settings", {
        key: "maxMembershipsPerPurchase",
        value: String(maxMemberships),
        description: "Maximum number of memberships allowed per purchase (for family/gift purchases)"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/max-memberships"] });
      toast({
        title: "Success",
        description: "Maximum memberships per purchase updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMaxMemberships(false);
    }
  };

  // Fetch membership plans
  const { data: plans, isLoading: plansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/admin/membership-plans"],
  });

  // Fetch punch card templates
  const { data: templates, isLoading: templatesLoading } = useQuery<PunchCardTemplate[]>({
    queryKey: ["/api/admin/punch-card-templates"],
  });

  // Membership plan mutations
  const planMutation = useMutation({
    mutationFn: async (planData: InsertMembershipPlan) => {
      const url = editingPlan 
        ? `/api/admin/membership-plans/${editingPlan.id}`
        : "/api/admin/membership-plans";
      const method = editingPlan ? "PUT" : "POST";
      const res = await apiRequest(method, url, planData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({
        title: "Success",
        description: editingPlan ? "Membership plan updated successfully" : "Membership plan created successfully",
      });
      resetPlanForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/membership-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({
        title: "Success",
        description: "Membership plan deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Punch card template mutations
  const templateMutation = useMutation({
    mutationFn: async (templateData: InsertPunchCardTemplate) => {
      const url = editingTemplate 
        ? `/api/admin/punch-card-templates/${editingTemplate.id}`
        : "/api/admin/punch-card-templates";
      const method = editingTemplate ? "PUT" : "POST";
      const res = await apiRequest(method, url, templateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/punch-card-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards/options"] });
      toast({
        title: "Success",
        description: editingTemplate ? "Day pass updated successfully" : "Day pass created successfully",
      });
      resetTemplateForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/punch-card-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/punch-card-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/punch-cards/options"] });
      setTemplateToDelete(null);
      toast({
        title: "Success",
        description: "Day pass deleted successfully",
      });
    },
    onError: (error: Error) => {
      setTemplateToDelete(null);
      toast({
        title: "Error", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync plans with Stripe
  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/membership-plans/sync-stripe");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      const synced = data.results?.filter((r: any) => r.status === 'synced').length || 0;
      const errors = data.results?.filter((r: any) => r.status === 'error').length || 0;
      toast({
        title: "Stripe Sync Complete",
        description: `${synced} plans synced successfully${errors > 0 ? `, ${errors} errors` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if any plans are missing Stripe configuration
  const plansNeedingSync = plans?.filter(p => !p.stripePriceId) || [];

  const handleDeleteTemplate = (id: number) => {
    setTemplateToDelete(id);
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete !== null) {
      deleteTemplateMutation.mutate(templateToDelete);
    }
  };

  // Form handlers
  const resetPlanForm = () => {
    setPlanFormData({
      planType: 'basic',
      name: '',
      monthlyPrice: 0,
      description: '',
      features: [],
      availableFrom: undefined,
      availableUntil: undefined,
      expiresAt: undefined,
      availableOnKiosk: true,
      availableOnWebsite: true,
      availableInCart: true
    });
    setHasExpiration(false);
    setHasAvailabilityDates(false);
    setHasNoEndDate(false);
    setEditingPlan(null);
    setIsCreatePlanOpen(false);
  };

  const resetTemplateForm = () => {
    setTemplateFormData({
      name: '',
      totalPunches: 0,
      pricePerPunch: 0,
      totalPrice: 0,
      description: '',
      isActive: true,
      sortOrder: 0,
      availableFrom: undefined,
      availableUntil: undefined,
      availableOnKiosk: true,
      availableOnWebsite: true,
      availableInCart: true
    });
    setTemplateHasAvailabilityDates(false);
    setTemplateHasNoEndDate(false);
    setEditingTemplate(null);
    setIsCreateTemplateOpen(false);
  };

  const handleEditPlan = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setPlanFormData({
      planType: plan.planType,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      description: plan.description,
      features: plan.features || [],
      availableFrom: plan.availableFrom || undefined,
      availableUntil: plan.availableUntil || undefined,
      expiresAt: plan.expiresAt || undefined,
      availableOnKiosk: plan.availableOnKiosk ?? true,
      availableOnWebsite: plan.availableOnWebsite ?? true,
      availableInCart: plan.availableInCart ?? true
    });
    setHasExpiration(!!plan.expiresAt);
    setHasAvailabilityDates(!!(plan.availableFrom || plan.availableUntil));
    setHasNoEndDate(!plan.availableUntil && !!plan.availableFrom);
    setIsCreatePlanOpen(true);
  };

  const handleEditTemplate = (template: PunchCardTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      totalPunches: template.totalPunches,
      pricePerPunch: template.pricePerPunch,
      totalPrice: template.totalPrice,
      description: template.description || '',
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      availableFrom: template.availableFrom || undefined,
      availableUntil: template.availableUntil || undefined,
      availableOnKiosk: template.availableOnKiosk ?? true,
      availableOnWebsite: template.availableOnWebsite ?? true,
      availableInCart: template.availableInCart ?? true
    });
    setTemplateHasAvailabilityDates(!!(template.availableFrom || template.availableUntil));
    setTemplateHasNoEndDate(!template.availableUntil && !!template.availableFrom);
    setIsCreateTemplateOpen(true);
  };

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormData.name || !planFormData.monthlyPrice || !planFormData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    planMutation.mutate(planFormData as InsertMembershipPlan);
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFormData.name || !templateFormData.totalPunches || !templateFormData.pricePerPunch) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const totalPrice = templateFormData.totalPrice || 
      (templateFormData.totalPunches * templateFormData.pricePerPunch);

    templateMutation.mutate({
      ...templateFormData,
      totalPrice,
    } as InsertPunchCardTemplate);
  };

  const handleFeatureAdd = (feature: string) => {
    if (feature && !planFormData.features?.includes(feature)) {
      setPlanFormData(prev => ({
        ...prev,
        features: [...(prev.features || []), feature]
      }));
    }
  };

  const handleFeatureRemove = (index: number) => {
    setPlanFormData(prev => ({
      ...prev,
      features: prev.features?.filter((_, i) => i !== index) || []
    }));
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'basic': return <DollarSign className="h-5 w-5" />;
      case 'premium': return <Star className="h-5 w-5" />;
      case 'vip': return <Crown className="h-5 w-5" />;
      case 'daily': return <Calendar className="h-5 w-5" />;
      default: return <DollarSign className="h-5 w-5" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'basic': return 'bg-blue-500';
      case 'premium': return 'bg-purple-500';
      case 'vip': return 'bg-amber-500';
      case 'daily': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (plansLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stripe Sync Warning Banner */}
      {plansNeedingSync.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              {plansNeedingSync.length} membership plan{plansNeedingSync.length > 1 ? 's' : ''} not configured for payments
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Members cannot checkout with these plans. Click "Sync with Stripe" to enable payments.
            </p>
          </div>
          <Button 
            onClick={() => syncStripeMutation.mutate()}
            disabled={syncStripeMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            data-testid="button-sync-stripe-warning"
          >
            {syncStripeMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync with Stripe
              </>
            )}
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Package Management</h1>
          <p className="text-muted-foreground">Manage membership plans and day pass packages</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => syncStripeMutation.mutate()}
          disabled={syncStripeMutation.isPending}
          data-testid="button-sync-stripe"
        >
          {syncStripeMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync with Stripe
            </>
          )}
        </Button>
      </div>

      {/* Multi-Membership Purchase Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Multi-Membership Purchase Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="max-memberships">Maximum memberships per purchase</Label>
              <p className="text-sm text-muted-foreground">
                How many memberships can be purchased at once (for family or gift purchases)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="max-memberships"
                type="number"
                min={1}
                max={10}
                value={maxMemberships}
                onChange={(e) => setMaxMemberships(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <Button
                onClick={handleSaveMaxMemberships}
                disabled={isUpdatingMaxMemberships || maxMemberships === maxMembershipsData?.maxMemberships}
                size="sm"
              >
                {isUpdatingMaxMemberships ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="memberships" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="memberships" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Membership Plans
          </TabsTrigger>
          <TabsTrigger value="day-passes" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Day Passes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="memberships" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Membership Plans</h2>
              <p className="text-muted-foreground">Recurring monthly membership packages</p>
            </div>
            <Button onClick={() => {
              resetPlanForm();
              setIsCreatePlanOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Membership Plan
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans?.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg text-white ${getPlanColor(plan.planType)}`}>
                        {getPlanIcon(plan.planType)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {plan.planType}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">${(plan.monthlyPrice / 100).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">per month</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">Features:</h4>
                    <ul className="space-y-1">
                      {plan.features?.slice(0, 3).map((feature, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                          {feature}
                        </li>
                      ))}
                      {plan.features && plan.features.length > 3 && (
                        <li className="text-sm text-muted-foreground">
                          +{plan.features.length - 3} more features
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePlanMutation.mutate(plan.id)}
                      disabled={deletePlanMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Membership Plan Form */}
          {isCreatePlanOpen && (
            <Card>
              <CardHeader>
                <CardTitle>{editingPlan ? 'Edit Membership Plan' : 'Create New Membership Plan'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePlanSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="plan-name">Plan Name *</Label>
                      <Input
                        id="plan-name"
                        value={planFormData.name}
                        onChange={(e) => setPlanFormData(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., Premium Membership"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan-type">Plan Type *</Label>
                      <Select 
                        value={planFormData.planType} 
                        onValueChange={(value) => setPlanFormData(prev => ({...prev, planType: value as any}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="monthly-price">Monthly Price ($) *</Label>
                      <Input
                        id="monthly-price"
                        type="number"
                        step="0.01"
                        value={((planFormData.monthlyPrice || 0) / 100).toFixed(2)}
                        onChange={(e) => setPlanFormData(prev => ({...prev, monthlyPrice: Math.round(parseFloat(e.target.value || "0") * 100)}))}
                        placeholder="159.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="plan-description">Description *</Label>
                    <Textarea
                      id="plan-description"
                      value={planFormData.description}
                      onChange={(e) => setPlanFormData(prev => ({...prev, description: e.target.value}))}
                      placeholder="Describe what this membership includes"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="has-expiration"
                        checked={hasExpiration}
                        onChange={(e) => {
                          setHasExpiration(e.target.checked);
                          if (!e.target.checked) {
                            setPlanFormData(prev => ({...prev, expiresAt: undefined}));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-has-expiration"
                      />
                      <Label htmlFor="has-expiration" className="cursor-pointer">
                        Set expiration date for this package
                      </Label>
                    </div>
                    {hasExpiration && (
                      <div>
                        <Label htmlFor="expires-at">Expiration Date</Label>
                        <Input
                          id="expires-at"
                          type="date"
                          value={planFormData.expiresAt ? new Date(planFormData.expiresAt).toISOString().split('T')[0] : ''}
                          onChange={(e) => setPlanFormData(prev => ({
                            ...prev,
                            expiresAt: e.target.value ? new Date(e.target.value) : undefined
                          }))}
                          min={new Date().toISOString().split('T')[0]}
                          data-testid="input-expires-at"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="has-availability-dates"
                        checked={hasAvailabilityDates}
                        onChange={(e) => {
                          setHasAvailabilityDates(e.target.checked);
                          if (!e.target.checked) {
                            setPlanFormData(prev => ({...prev, availableFrom: undefined, availableUntil: undefined}));
                            setHasNoEndDate(false);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-has-availability-dates"
                      />
                      <Label htmlFor="has-availability-dates" className="cursor-pointer">
                        Set availability date range
                      </Label>
                    </div>
                    {hasAvailabilityDates && (
                      <div className="space-y-3 pl-6">
                        <div>
                          <Label htmlFor="available-from">Available From</Label>
                          <Input
                            id="available-from"
                            type="date"
                            value={planFormData.availableFrom ? new Date(planFormData.availableFrom).toISOString().split('T')[0] : ''}
                            onChange={(e) => setPlanFormData(prev => ({
                              ...prev,
                              availableFrom: e.target.value ? new Date(e.target.value) : undefined
                            }))}
                            data-testid="input-available-from"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="has-no-end-date"
                            checked={hasNoEndDate}
                            onChange={(e) => {
                              setHasNoEndDate(e.target.checked);
                              if (e.target.checked) {
                                setPlanFormData(prev => ({...prev, availableUntil: undefined}));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid="checkbox-has-no-end-date"
                          />
                          <Label htmlFor="has-no-end-date" className="cursor-pointer">
                            No end date (always available)
                          </Label>
                        </div>
                        {!hasNoEndDate && (
                          <div>
                            <Label htmlFor="available-until">Available Until</Label>
                            <Input
                              id="available-until"
                              type="date"
                              value={planFormData.availableUntil ? new Date(planFormData.availableUntil).toISOString().split('T')[0] : ''}
                              onChange={(e) => setPlanFormData(prev => ({
                                ...prev,
                                availableUntil: e.target.value ? new Date(e.target.value) : undefined
                              }))}
                              min={planFormData.availableFrom ? new Date(planFormData.availableFrom).toISOString().split('T')[0] : ''}
                              data-testid="input-available-until"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Features</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          id="new-feature"
                          placeholder="Add a feature"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.target as HTMLInputElement;
                              handleFeatureAdd(input.value);
                              input.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById('new-feature') as HTMLInputElement;
                            handleFeatureAdd(input.value);
                            input.value = '';
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {planFormData.features?.map((feature, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {feature}
                            <button
                              type="button"
                              onClick={() => handleFeatureRemove(index)}
                              className="ml-1 text-xs hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Purchase Channels</Label>
                    <p className="text-xs text-muted-foreground">Where can members purchase this plan?</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="plan-available-kiosk"
                          checked={planFormData.availableOnKiosk}
                          onChange={(e) => setPlanFormData(prev => ({...prev, availableOnKiosk: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="plan-available-kiosk" className="cursor-pointer flex items-center gap-1.5">
                          <Tablet className="h-4 w-4" />
                          Kiosk
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="plan-available-website"
                          checked={planFormData.availableOnWebsite}
                          onChange={(e) => setPlanFormData(prev => ({...prev, availableOnWebsite: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="plan-available-website" className="cursor-pointer flex items-center gap-1.5">
                          <Monitor className="h-4 w-4" />
                          Website
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="plan-available-cart"
                          checked={planFormData.availableInCart}
                          onChange={(e) => setPlanFormData(prev => ({...prev, availableInCart: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="plan-available-cart" className="cursor-pointer flex items-center gap-1.5">
                          <ShoppingCart className="h-4 w-4" />
                          Cart
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={planMutation.isPending}>
                      {planMutation.isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetPlanForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="day-passes" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Day Pass Packages</h2>
              <p className="text-muted-foreground">One-time visit packages for members</p>
            </div>
            <Button onClick={() => {
              resetTemplateForm();
              setIsCreateTemplateOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Day Pass
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates?.map((template) => (
              <Card key={template.id} className={`relative transition-all ${!template.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Total Visits:</span>
                      <span className="font-medium">{template.totalPunches}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Per Visit:</span>
                      <span className="font-medium">${(template.pricePerPunch / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span>Total Price:</span>
                      <span>${(template.totalPrice / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      disabled={deleteTemplateMutation.isPending}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Day Pass Template Form */}
          {isCreateTemplateOpen && (
            <Card>
              <CardHeader>
                <CardTitle>{editingTemplate ? 'Edit Day Pass' : 'Create New Day Pass'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTemplateSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-name">Package Name *</Label>
                      <Input
                        id="template-name"
                        value={templateFormData.name}
                        onChange={(e) => setTemplateFormData(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., 10-Day Pass"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="total-punches">Total Visits *</Label>
                      <Input
                        id="total-punches"
                        type="number"
                        value={templateFormData.totalPunches}
                        onChange={(e) => {
                          const punches = parseInt(e.target.value) || 0;
                          setTemplateFormData(prev => ({
                            ...prev, 
                            totalPunches: punches,
                            totalPrice: punches * (prev.pricePerPunch || 0)
                          }));
                        }}
                        placeholder="10"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="price-per-punch">Price Per Visit ($) *</Label>
                      <Input
                        id="price-per-punch"
                        type="number"
                        step="0.01"
                        value={((templateFormData.pricePerPunch || 0) / 100).toFixed(2)}
                        onChange={(e) => {
                          const price = Math.round(parseFloat(e.target.value || "0") * 100);
                          setTemplateFormData(prev => ({
                            ...prev, 
                            pricePerPunch: price,
                            totalPrice: (prev.totalPunches || 0) * price
                          }));
                        }}
                        placeholder="25.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="total-price">Total Price ($)</Label>
                      <Input
                        id="total-price"
                        type="number"
                        step="0.01"
                        value={((templateFormData.totalPrice || 0) / 100).toFixed(2)}
                        onChange={(e) => setTemplateFormData(prev => ({...prev, totalPrice: Math.round(parseFloat(e.target.value || "0") * 100)}))}
                        placeholder="Auto-calculated"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sort-order">Sort Order</Label>
                      <Input
                        id="sort-order"
                        type="number"
                        value={templateFormData.sortOrder}
                        onChange={(e) => setTemplateFormData(prev => ({...prev, sortOrder: parseInt(e.target.value) || 0}))}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is-active"
                        checked={templateFormData.isActive}
                        onChange={(e) => setTemplateFormData(prev => ({...prev, isActive: e.target.checked}))}
                      />
                      <Label htmlFor="is-active">Active (visible to members)</Label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Input
                      id="template-description"
                      value={templateFormData.description || ''}
                      onChange={(e) => setTemplateFormData(prev => ({...prev, description: e.target.value}))}
                      placeholder="Brief description of this package"
                    />
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="template-has-availability-dates"
                        checked={templateHasAvailabilityDates}
                        onChange={(e) => {
                          setTemplateHasAvailabilityDates(e.target.checked);
                          if (!e.target.checked) {
                            setTemplateFormData(prev => ({...prev, availableFrom: undefined, availableUntil: undefined}));
                            setTemplateHasNoEndDate(false);
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-template-has-availability-dates"
                      />
                      <Label htmlFor="template-has-availability-dates" className="cursor-pointer">
                        Set availability date range
                      </Label>
                    </div>
                    {templateHasAvailabilityDates && (
                      <div className="space-y-3 pl-6">
                        <div>
                          <Label htmlFor="template-available-from">Available From</Label>
                          <Input
                            id="template-available-from"
                            type="date"
                            value={templateFormData.availableFrom ? new Date(templateFormData.availableFrom).toISOString().split('T')[0] : ''}
                            onChange={(e) => setTemplateFormData(prev => ({
                              ...prev,
                              availableFrom: e.target.value ? new Date(e.target.value) : undefined
                            }))}
                            data-testid="input-template-available-from"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="template-has-no-end-date"
                            checked={templateHasNoEndDate}
                            onChange={(e) => {
                              setTemplateHasNoEndDate(e.target.checked);
                              if (e.target.checked) {
                                setTemplateFormData(prev => ({...prev, availableUntil: undefined}));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid="checkbox-template-has-no-end-date"
                          />
                          <Label htmlFor="template-has-no-end-date" className="cursor-pointer">
                            No end date (always available)
                          </Label>
                        </div>
                        {!templateHasNoEndDate && (
                          <div>
                            <Label htmlFor="template-available-until">Available Until</Label>
                            <Input
                              id="template-available-until"
                              type="date"
                              value={templateFormData.availableUntil ? new Date(templateFormData.availableUntil).toISOString().split('T')[0] : ''}
                              onChange={(e) => setTemplateFormData(prev => ({
                                ...prev,
                                availableUntil: e.target.value ? new Date(e.target.value) : undefined
                              }))}
                              min={templateFormData.availableFrom ? new Date(templateFormData.availableFrom).toISOString().split('T')[0] : ''}
                              data-testid="input-template-available-until"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Purchase Channels</Label>
                    <p className="text-xs text-muted-foreground">Where can members purchase this day pass?</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="template-available-kiosk"
                          checked={templateFormData.availableOnKiosk}
                          onChange={(e) => setTemplateFormData(prev => ({...prev, availableOnKiosk: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="template-available-kiosk" className="cursor-pointer flex items-center gap-1.5">
                          <Tablet className="h-4 w-4" />
                          Kiosk
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="template-available-website"
                          checked={templateFormData.availableOnWebsite}
                          onChange={(e) => setTemplateFormData(prev => ({...prev, availableOnWebsite: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="template-available-website" className="cursor-pointer flex items-center gap-1.5">
                          <Monitor className="h-4 w-4" />
                          Website
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="template-available-cart"
                          checked={templateFormData.availableInCart}
                          onChange={(e) => setTemplateFormData(prev => ({...prev, availableInCart: e.target.checked}))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="template-available-cart" className="cursor-pointer flex items-center gap-1.5">
                          <ShoppingCart className="h-4 w-4" />
                          Cart
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={templateMutation.isPending}>
                      {templateMutation.isPending ? "Saving..." : editingTemplate ? "Update Day Pass" : "Create Day Pass"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetTemplateForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={templateToDelete !== null} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Day Pass Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this day pass package. This action cannot be undone.
              Members who have already purchased this package will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemplateMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              disabled={deleteTemplateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}