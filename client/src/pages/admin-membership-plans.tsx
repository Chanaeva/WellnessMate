import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MembershipPlan, insertMembershipPlanSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit, Trash2, Crown, Shield, Flame, Waves, Save, X } from "lucide-react";
import { Link } from "wouter";

const planTypeOptions = [
  { value: "basic", label: "Basic", icon: Shield },
  { value: "premium", label: "Premium", icon: Crown },
  { value: "vip", label: "VIP", icon: Flame },
  { value: "daily", label: "Daily", icon: Waves },
];

export default function AdminMembershipPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  // Fetch membership plans
  const { data: membershipPlans = [], isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/admin/membership-plans"],
    enabled: !!user && user.role === 'admin',
  });

  // Form for creating/editing plans
  const form = useForm({
    resolver: zodResolver(insertMembershipPlanSchema),
    defaultValues: {
      name: "",
      description: "",
      planType: "basic" as const,
      monthlyPrice: 0,
      features: [],
      isActive: true,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/membership-plans", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Created",
        description: "Membership plan has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create membership plan",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/membership-plans/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Updated",
        description: "Membership plan has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
      setEditingPlan(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update membership plan",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/membership-plans/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Deleted",
        description: "Membership plan has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/membership-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/membership-plans"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete membership plan",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    const formattedData = {
      ...data,
      monthlyPrice: data.monthlyPrice, // Already in cents from PriceInput
      features: data.features ? data.features.split('\n').filter((f: string) => f.trim()) : [],
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      description: plan.description,
      planType: plan.planType,
      monthlyPrice: plan.monthlyPrice, // Already in cents
      features: plan.features.join('\n'),
      isActive: plan.isActive,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  const getPlanIcon = (planType: string) => {
    const option = planTypeOptions.find(opt => opt.value === planType);
    return option ? option.icon : Shield;
  };

  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-heading mb-4">Access Denied</h1>
              <p className="text-muted-foreground mb-6">You need admin privileges to access this page.</p>
              <Link href="/">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading text-foreground">Membership Plans Management</h1>
            <p className="text-muted-foreground mt-2">Create and manage membership packages for Wolf Mother Wellness</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingPlan(null);
                form.reset();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Edit' : 'Create'} Membership Plan</DialogTitle>
                <DialogDescription>
                  {editingPlan ? 'Update the membership plan details' : 'Create a new membership plan for your wellness center'}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Warrior's Strength" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="planType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select plan type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {planTypeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="monthlyPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Price</FormLabel>
                        <FormControl>
                          <PriceInput 
                            value={field.value || 0}
                            onChange={field.onChange}
                            placeholder="99.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the membership plan..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="features"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Features (one per line)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Unlimited sauna access&#10;Cold plunge privileges&#10;Premium amenities"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingPlan ? 'Update' : 'Create'} Plan
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Membership Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading plans...</div>
            ) : membershipPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No membership plans found. Create your first plan to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membershipPlans.map((plan) => {
                    const IconComponent = getPlanIcon(plan.planType);
                    return (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                              <IconComponent className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{plan.name}</div>
                              <div className="text-sm text-muted-foreground">{plan.description}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {plan.planType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(plan.monthlyPrice)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.isActive ? "default" : "secondary"}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {plan.features.length} features
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(plan)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{plan.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(plan.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Plan
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}