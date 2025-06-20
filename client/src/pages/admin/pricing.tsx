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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, DollarSign, Crown, Star, Zap } from "lucide-react";

export default function PricingManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PunchCardTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<InsertMembershipPlan>>({
    planType: 'basic',
    name: '',
    monthlyPrice: 0,
    description: '',
    features: []
  });
  const [templateFormData, setTemplateFormData] = useState<Partial<InsertPunchCardTemplate>>({
    name: '',
    totalPunches: 0,
    pricePerPunch: 0,
    totalPrice: 0,
    description: '',
    isActive: true,
    sortOrder: 0
  });

  // Fetch membership plans from admin endpoint
  const { data: plans, isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/admin/membership-plans"],
  });

  // Fetch punch card templates
  const { data: templates, isLoading: templatesLoading } = useQuery<PunchCardTemplate[]>({
    queryKey: ["/api/admin/punch-card-templates"],
  });

  // Create/Update plan mutation
  const planMutation = useMutation({
    mutationFn: async (planData: InsertMembershipPlan) => {
      const res = await apiRequest("POST", "/api/admin/membership-plans", planData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      toast({
        title: "Success",
        description: editingPlan ? "Plan updated successfully" : "Plan created successfully",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Template mutations
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

  const resetForm = () => {
    setFormData({
      planType: 'basic',
      name: '',
      monthlyPrice: 0,
      description: '',
      features: []
    });
    setEditingPlan(null);
    setIsCreateDialogOpen(false);
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
  };

  const handleEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setFormData({
      planType: plan.planType,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      description: plan.description,
      features: plan.features || []
    });
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.monthlyPrice || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    planMutation.mutate(formData as InsertMembershipPlan);
  };

  const handleFeatureAdd = () => {
    const newFeature = (document.getElementById('new-feature') as HTMLInputElement)?.value;
    if (newFeature && !formData.features?.includes(newFeature)) {
      setFormData(prev => ({
        ...prev,
        features: [...(prev.features || []), newFeature]
      }));
      (document.getElementById('new-feature') as HTMLInputElement).value = '';
    }
  };

  const handleFeatureRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features?.filter((_, i) => i !== index) || []
    }));
  };

  const handleTemplateEdit = (template: PunchCardTemplate) => {
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

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'basic': return <DollarSign className="h-5 w-5" />;
      case 'premium': return <Star className="h-5 w-5" />;
      case 'vip': return <Crown className="h-5 w-5" />;
      case 'daily': return <Zap className="h-5 w-5" />;
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

  if (isLoading) {
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
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">Manage membership plans and pricing</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Edit Membership Plan' : 'Create New Membership Plan'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planType">Plan Type</Label>
                  <Select 
                    value={formData.planType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, planType: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="daily">Daily Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Monthly Membership"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="monthlyPrice">Monthly Price (cents)</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, monthlyPrice: parseInt(e.target.value) || 0 }))}
                  placeholder="6500"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Price in cents (e.g., 6500 = $65.00)
                </p>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Full access to all wellness facilities"
                />
              </div>
              
              <div>
                <Label>Features</Label>
                <div className="space-y-2">
                  {formData.features?.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="flex-1 text-sm bg-muted p-2 rounded">{feature}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFeatureRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      id="new-feature"
                      placeholder="Add a feature"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleFeatureAdd())}
                    />
                    <Button type="button" variant="outline" onClick={handleFeatureAdd}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={planMutation.isPending}>
                  {planMutation.isPending ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans?.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden">
            <div className={`h-24 ${getPlanColor(plan.planType)} relative`}>
              <div className="absolute inset-0 bg-black/5"></div>
              <div className="relative h-full p-4 flex items-center justify-between text-white">
                <div className="flex items-center space-x-2">
                  {getPlanIcon(plan.planType)}
                  <span className="font-semibold capitalize">{plan.planType}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${(plan.monthlyPrice / 100).toFixed(0)}
                  </div>
                  <div className="text-sm opacity-90">per month</div>
                </div>
              </div>
            </div>
            
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>{plan.name}</span>
                <Badge variant="secondary" className="capitalize">
                  {plan.planType}
                </Badge>
              </CardTitle>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
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
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(plan)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Day Pass Templates Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Day Pass Packages</h2>
            <p className="text-muted-foreground">Manage available day pass options for members</p>
          </div>
          <Button onClick={() => {
            resetTemplateForm();
            setEditingTemplate(null);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Day Pass
          </Button>
        </div>

        {templatesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      onClick={() => handleTemplateEdit(template)}
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
        )}

        {/* Template Form */}
        {(editingTemplate || templateFormData.name) && (
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
                    <Label htmlFor="price-per-punch">Price Per Visit (cents) *</Label>
                    <Input
                      id="price-per-punch"
                      type="number"
                      value={templateFormData.pricePerPunch}
                      onChange={(e) => {
                        const price = parseInt(e.target.value) || 0;
                        setTemplateFormData(prev => ({
                          ...prev, 
                          pricePerPunch: price,
                          totalPrice: (prev.totalPunches || 0) * price
                        }));
                      }}
                      placeholder="2500"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="total-price">Total Price (cents)</Label>
                    <Input
                      id="total-price"
                      type="number"
                      value={templateFormData.totalPrice}
                      onChange={(e) => setTemplateFormData(prev => ({...prev, totalPrice: parseInt(e.target.value) || 0}))}
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
      </div>
    </div>
  );
}