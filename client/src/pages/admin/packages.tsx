import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MembershipPlan, InsertMembershipPlan, PunchCardTemplate, InsertPunchCardTemplate } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, DollarSign, Crown, Star, Zap, CreditCard, Calendar } from "lucide-react";

export default function PackagesManagement() {
  const { toast } = useToast();
  
  // Membership plan state
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [planFormData, setPlanFormData] = useState<Partial<InsertMembershipPlan>>({
    planType: 'basic',
    name: '',
    monthlyPrice: 0,
    description: '',
    features: []
  });

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
    sortOrder: 0
  });

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
      toast({
        title: "Success",
        description: "Day pass deleted successfully",
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

  // Form handlers
  const resetPlanForm = () => {
    setPlanFormData({
      planType: 'basic',
      name: '',
      monthlyPrice: 0,
      description: '',
      features: []
    });
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
      sortOrder: 0
    });
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
      features: plan.features || []
    });
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
      sortOrder: template.sortOrder
    });
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Package Management</h1>
          <p className="text-muted-foreground">Manage membership plans and day pass packages</p>
        </div>
      </div>

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
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                      disabled={deleteTemplateMutation.isPending}
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
    </div>
  );
}