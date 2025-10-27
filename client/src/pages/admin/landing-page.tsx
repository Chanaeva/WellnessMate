import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LandingPageContent, insertLandingPageContentSchema, Promotion, insertPromotionSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Edit, 
  Trash2, 
  Plus, 
  Eye, 
  Star,
  Tag,
  Calendar,
  DollarSign,
  Megaphone,
  Settings,
  Clock,
  Building2,
  Copyright,
  Instagram
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Form schemas
const landingPageContentFormSchema = insertLandingPageContentSchema.extend({
  isActive: z.boolean().default(true),
});

const promotionFormSchema = insertPromotionSchema.extend({
  isActive: z.boolean().default(true),
});

type LandingPageContentFormData = z.infer<typeof landingPageContentFormSchema>;
type PromotionFormData = z.infer<typeof promotionFormSchema>;

export default function LandingPageManagement() {
  const { toast } = useToast();
  const [editingContent, setEditingContent] = useState<LandingPageContent | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  
  // Site settings state
  const [siteSettings, setSiteSettings] = useState({
    hoursOfOperation: '',
    hoursMembers: '',
    hoursDayPass: '',
    address: '',
    addressLine2: '',
    copyrightYear: '',
    instagramHandle: '',
  });

  // Fetch landing page content
  const { data: landingPageContent = [], isLoading: isContentLoading } = useQuery<LandingPageContent[]>({
    queryKey: ["/api/admin/landing-content"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/landing-content");
      return await res.json();
    },
  });

  // Group content by section
  const contentBySection = landingPageContent.reduce((acc: Record<string, LandingPageContent[]>, content) => {
    if (!acc[content.section]) {
      acc[content.section] = [];
    }
    acc[content.section].push(content);
    return acc;
  }, {});

  // Fetch promotions
  const { data: promotions = [], isLoading: isPromotionsLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/admin/promotions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/promotions");
      return await res.json();
    },
  });

  // Fetch site settings
  const { data: footerData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['/api/landing-content/footer'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landing-content/footer");
      return await res.json();
    },
  });

  // Update siteSettings when footerData changes
  useEffect(() => {
    if (footerData && Array.isArray(footerData)) {
      const settingsObj = {
        hoursOfOperation: footerData.find((s: any) => s.key === 'hoursOfOperation')?.value || '6:00 AM - 10:00 PM',
        hoursMembers: footerData.find((s: any) => s.key === 'hoursMembers')?.value || '6:00 AM - 9:00 AM',
        hoursDayPass: footerData.find((s: any) => s.key === 'hoursDayPass')?.value || '9:00 AM - 10:00 PM',
        address: footerData.find((s: any) => s.key === 'address')?.value || '2124 W Admiral',
        addressLine2: footerData.find((s: any) => s.key === 'addressLine2')?.value || 'Kendall Whitter Neighborhood\nTulsa, OK',
        copyrightYear: footerData.find((s: any) => s.key === 'copyrightYear')?.value || '2025',
        instagramHandle: footerData.find((s: any) => s.key === 'instagramHandle')?.value || 'wolfmothertulsa',
      };
      setSiteSettings(settingsObj);
    }
  }, [footerData]);

  // Content form
  const contentForm = useForm<LandingPageContentFormData>({
    resolver: zodResolver(landingPageContentFormSchema),
    defaultValues: {
      section: "",
      key: "",
      value: "",
      isActive: true,
    },
  });

  // Promotion form
  const [hasPromotionAvailabilityDates, setHasPromotionAvailabilityDates] = useState(false);
  const [hasPromotionNoEndDate, setHasPromotionNoEndDate] = useState(false);

  const promotionForm = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      title: "",
      description: "",
      code: "",
      validUntil: "",
      bgColor: "bg-gradient-to-r from-amber-500 to-orange-600",
      textColor: "text-white",
      sortOrder: 0,
      availableFrom: undefined,
      availableUntil: undefined,
      discountType: "percentage",
      discountValue: 0,
      isActive: true,
    },
  });

  // Content mutations
  const createContentMutation = useMutation({
    mutationFn: async (data: LandingPageContentFormData) => {
      const res = await apiRequest("POST", "/api/admin/landing-content", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/landing-content"] });
      setIsContentDialogOpen(false);
      contentForm.reset();
      toast({
        title: "Success",
        description: "Landing page content created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create content",
        variant: "destructive",
      });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LandingPageContentFormData> }) => {
      const res = await apiRequest("PUT", `/api/admin/landing-content/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/landing-content"] });
      setIsContentDialogOpen(false);
      setEditingContent(null);
      contentForm.reset();
      toast({
        title: "Success",
        description: "Landing page content updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update content",
        variant: "destructive",
      });
    },
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/landing-content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/landing-content"] });
      toast({
        title: "Success",
        description: "Landing page content deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete content",
        variant: "destructive",
      });
    },
  });

  // Promotion mutations
  const createPromotionMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const res = await apiRequest("POST", "/api/admin/promotions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      setIsPromotionDialogOpen(false);
      promotionForm.reset();
      toast({
        title: "Success",
        description: "Promotion created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create promotion",
        variant: "destructive",
      });
    },
  });

  const updatePromotionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PromotionFormData> }) => {
      const res = await apiRequest("PUT", `/api/admin/promotions/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      setIsPromotionDialogOpen(false);
      setEditingPromotion(null);
      promotionForm.reset();
      toast({
        title: "Success",
        description: "Promotion updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update promotion",
        variant: "destructive",
      });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({
        title: "Success",
        description: "Promotion deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promotion",
        variant: "destructive",
      });
    },
  });

  // Site settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: typeof siteSettings) => {
      const res = await apiRequest("POST", "/api/admin/site-settings", settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-content/footer'] });
      toast({
        title: "Settings Saved",
        description: "Your changes have been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const handleContentSubmit = (data: LandingPageContentFormData) => {
    if (editingContent) {
      updateContentMutation.mutate({ id: editingContent.id, data });
    } else {
      createContentMutation.mutate(data);
    }
  };

  const handlePromotionSubmit = (data: PromotionFormData) => {
    // Convert fixed_amount from dollars to cents for storage
    const submitData = {
      ...data,
      discountValue: data.discountType === 'fixed_amount' 
        ? Math.round((data.discountValue || 0) * 100) 
        : data.discountValue || 0,
    };
    
    if (editingPromotion) {
      updatePromotionMutation.mutate({ id: editingPromotion.id, data: submitData });
    } else {
      createPromotionMutation.mutate(submitData);
    }
  };

  const handleEditContent = (content: LandingPageContent) => {
    setEditingContent(content);
    contentForm.reset({
      section: content.section,
      key: content.key,
      value: content.value,
      isActive: content.isActive,
    });
    setIsContentDialogOpen(true);
  };

  const handleEditPromotion = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    const hasAvailability = !!(promotion.availableFrom || promotion.availableUntil);
    setHasPromotionAvailabilityDates(hasAvailability);
    setHasPromotionNoEndDate(!promotion.availableUntil && !!promotion.availableFrom);
    
    // Convert fixed_amount from cents to dollars for display
    const displayValue = promotion.discountType === 'fixed_amount' 
      ? (promotion.discountValue || 0) / 100 
      : promotion.discountValue || 0;
    
    promotionForm.reset({
      title: promotion.title,
      description: promotion.description,
      code: promotion.code,
      validUntil: promotion.validUntil,
      bgColor: promotion.bgColor,
      textColor: promotion.textColor,
      sortOrder: promotion.sortOrder,
      availableFrom: promotion.availableFrom || undefined,
      availableUntil: promotion.availableUntil || undefined,
      discountType: promotion.discountType || "percentage",
      discountValue: displayValue,
      isActive: promotion.isActive,
    });
    setIsPromotionDialogOpen(true);
  };

  const handleNewContent = () => {
    setEditingContent(null);
    contentForm.reset({
      section: "",
      key: "",
      value: "",
      isActive: true,
    });
    setIsContentDialogOpen(true);
  };

  const handleNewPromotion = () => {
    setEditingPromotion(null);
    setHasPromotionAvailabilityDates(false);
    setHasPromotionNoEndDate(false);
    
    promotionForm.reset({
      title: "",
      description: "",
      code: "",
      validUntil: "",
      bgColor: "bg-gradient-to-r from-amber-500 to-orange-600",
      textColor: "text-white",
      sortOrder: 0,
      availableFrom: undefined,
      availableUntil: undefined,
      discountType: "percentage",
      discountValue: 0,
      isActive: true,
    });
    setIsPromotionDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Landing Page Management</h2>
          <p className="text-muted-foreground">Manage landing page content and promotions</p>
        </div>
        <Button onClick={() => window.open("/", "_blank")}>
          <Eye className="h-4 w-4 mr-2" />
          Preview Landing Page
        </Button>
      </div>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content">Page Content</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="settings">Site Settings</TabsTrigger>
        </TabsList>

        {/* Page Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Page Content Sections</h3>
            <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNewContent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Content Section
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingContent ? "Edit Content Section" : "Add Content Section"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...contentForm}>
                  <form onSubmit={contentForm.handleSubmit(handleContentSubmit)} className="space-y-4">
                    <FormField
                      control={contentForm.control}
                      name="section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select section" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="hero">Hero Section</SelectItem>
                              <SelectItem value="features">Features</SelectItem>
                              <SelectItem value="testimonials">Testimonials</SelectItem>
                              <SelectItem value="contact">Contact</SelectItem>
                              <SelectItem value="about">About</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contentForm.control}
                      name="key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Content key (e.g., heroTitle)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contentForm.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Content value" 
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contentForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Active</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setIsContentDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createContentMutation.isPending || updateContentMutation.isPending}
                      >
                        {editingContent ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Content Sections */}
          <div className="space-y-6">
            {isContentLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading content...</p>
              </div>
            ) : landingPageContent.length > 0 ? (
              Object.keys(contentBySection).sort().map((section) => {
                const isFooter = section === 'footer';
                
                return (
                  <div key={section} className="space-y-4">
                    {/* Section Header */}
                    <div className="border-b pb-2">
                      <h4 className="text-lg font-semibold capitalize text-foreground">
                        {section}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {isFooter ? '1 content block' : `${contentBySection[section].length} content ${contentBySection[section].length === 1 ? 'block' : 'blocks'}`}
                      </p>
                    </div>
                    
                    {/* Content Cards */}
                    {isFooter ? (
                      // Footer: Display as single card with all fields
                      <Card className="border-l-4 border-l-primary/30 pl-4">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4" />
                            Footer Settings
                            <Badge variant="outline" className="text-xs">
                              {contentBySection[section].length} fields
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {contentBySection[section].map((content) => (
                            <div key={content.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-foreground">{content.key}</span>
                                  <Badge variant={content.isActive ? "default" : "secondary"} className="text-xs">
                                    {content.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{content.value}</p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditContent(content)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteContentMutation.mutate(content.id)}
                                  disabled={deleteContentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ) : (
                      // Other sections: Display as individual cards
                      <div className="grid gap-3 pl-4">
                        {contentBySection[section].map((content) => (
                          <Card key={content.id} className="border-l-4 border-l-primary/30">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                              <div className="flex-1">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <FileText className="h-4 w-4" />
                                  {content.key}
                                  <Badge variant={content.isActive ? "default" : "secondary"} className="text-xs">
                                    {content.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </CardTitle>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditContent(content)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteContentMutation.mutate(content.id)}
                                  disabled={deleteContentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm text-muted-foreground">{content.value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No content blocks yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first content block to customize your landing page
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Promotions Tab */}
        <TabsContent value="promotions" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Promotional Offers</h3>
            <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNewPromotion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Promotion
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPromotion ? "Edit Promotion" : "Create Promotion"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...promotionForm}>
                  <form onSubmit={promotionForm.handleSubmit(handlePromotionSubmit)} className="space-y-4">
                    <FormField
                      control={promotionForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Promotion title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={promotionForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Promotion description" 
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={promotionForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Promo Code</FormLabel>
                            <FormControl>
                              <Input placeholder="PROMO2025" {...field} data-testid="input-promo-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promotionForm.control}
                        name="validUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid Until</FormLabel>
                            <FormControl>
                              <Input placeholder="Dec 31, 2025" {...field} data-testid="input-valid-until" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-3 border-t pt-4">
                      <h4 className="text-sm font-medium">Discount Settings</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={promotionForm.control}
                          name="discountType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "percentage"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-discount-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                                  <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={promotionForm.control}
                          name="discountValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {promotionForm.watch('discountType') === 'percentage' 
                                  ? 'Discount (%)' 
                                  : 'Discount ($)'}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0"
                                  max={promotionForm.watch('discountType') === 'percentage' ? 100 : undefined}
                                  step={promotionForm.watch('discountType') === 'percentage' ? 1 : 0.01}
                                  placeholder={promotionForm.watch('discountType') === 'percentage' ? '10' : '5.00'}
                                  {...field}
                                  value={field.value || 0}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                  }}
                                  data-testid="input-discount-value"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="promotion-has-availability-dates"
                          checked={hasPromotionAvailabilityDates}
                          onChange={(e) => {
                            setHasPromotionAvailabilityDates(e.target.checked);
                            if (!e.target.checked) {
                              promotionForm.setValue('availableFrom', undefined);
                              promotionForm.setValue('availableUntil', undefined);
                              setHasPromotionNoEndDate(false);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="checkbox-promotion-has-availability-dates"
                        />
                        <label htmlFor="promotion-has-availability-dates" className="text-sm font-medium cursor-pointer">
                          Set availability date range
                        </label>
                      </div>
                      {hasPromotionAvailabilityDates && (
                        <div className="space-y-3 pl-6">
                          <FormField
                            control={promotionForm.control}
                            name="availableFrom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Available From</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (field.value ? String(field.value).split('T')[0] : '')}
                                    onChange={(e) => field.onChange(e.target.value ? e.target.value : undefined)}
                                    data-testid="input-promotion-available-from"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="promotion-has-no-end-date"
                              checked={hasPromotionNoEndDate}
                              onChange={(e) => {
                                setHasPromotionNoEndDate(e.target.checked);
                                if (e.target.checked) {
                                  promotionForm.setValue('availableUntil', undefined);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                              data-testid="checkbox-promotion-has-no-end-date"
                            />
                            <label htmlFor="promotion-has-no-end-date" className="text-sm font-medium cursor-pointer">
                              No end date (always available)
                            </label>
                          </div>
                          {!hasPromotionNoEndDate && (
                            <FormField
                              control={promotionForm.control}
                              name="availableUntil"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Available Until</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : (field.value ? String(field.value).split('T')[0] : '')}
                                      onChange={(e) => field.onChange(e.target.value ? e.target.value : undefined)}
                                      data-testid="input-promotion-available-until"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <FormField
                      control={promotionForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Active Promotion</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Enable this promotion to show on landing page
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setIsPromotionDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createPromotionMutation.isPending || updatePromotionMutation.isPending}
                      >
                        {editingPromotion ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Promotions */}
          <div className="grid gap-4">
            {isPromotionsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading promotions...</p>
              </div>
            ) : promotions.length > 0 ? (
              promotions.map((promotion) => (
                <Card key={promotion.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4" />
                        {promotion.title}
                        <Badge variant={promotion.isActive ? "default" : "secondary"}>
                          {promotion.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {promotion.code && (
                          <>
                            Code: <span className="font-mono">{promotion.code}</span>
                            {" • "}
                          </>
                        )}
                        Valid until: {promotion.validUntil}
                        {(promotion.availableFrom || promotion.availableUntil) && (
                          <>
                            <br />
                            <Calendar className="h-3 w-3 inline mr-1" />
                            Available: {promotion.availableFrom ? format(new Date(promotion.availableFrom), "MMM d, yyyy") : "Now"}
                            {promotion.availableUntil ? ` - ${format(new Date(promotion.availableUntil), "MMM d, yyyy")}` : " onwards"}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPromotion(promotion)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePromotionMutation.mutate(promotion.id)}
                        disabled={deletePromotionMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{promotion.description}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No promotions yet. Create your first one!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Site Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Footer & Contact Information</h3>
            <Button onClick={() => saveSettingsMutation.mutate(siteSettings)} disabled={saveSettingsMutation.isPending}>
              <Settings className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>

          {isSettingsLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading settings...</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Hours of Operation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Hours of Operation
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Set the hours displayed on the landing page
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hoursOfOperation">Daily Hours</Label>
                    <Input
                      id="hoursOfOperation"
                      value={siteSettings.hoursOfOperation}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hoursOfOperation: e.target.value })}
                      placeholder="6:00 AM - 10:00 PM"
                      data-testid="input-hours-operation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoursMembers">Members Only Access</Label>
                    <Input
                      id="hoursMembers"
                      value={siteSettings.hoursMembers}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hoursMembers: e.target.value })}
                      placeholder="6:00 AM - 9:00 AM"
                      data-testid="input-hours-members"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoursDayPass">Day Pass Access</Label>
                    <Input
                      id="hoursDayPass"
                      value={siteSettings.hoursDayPass}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hoursDayPass: e.target.value })}
                      placeholder="9:00 AM - 10:00 PM"
                      data-testid="input-hours-daypass"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Address
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Physical location displayed on the landing page
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={siteSettings.address}
                      onChange={(e) => setSiteSettings({ ...siteSettings, address: e.target.value })}
                      placeholder="2124 E Admiral"
                      data-testid="input-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">City, State</Label>
                    <Textarea
                      id="addressLine2"
                      value={siteSettings.addressLine2}
                      onChange={(e) => setSiteSettings({ ...siteSettings, addressLine2: e.target.value })}
                      placeholder="Kendall Whitter Neighborhood&#10;Tulsa, OK"
                      rows={2}
                      data-testid="input-address-line2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Copyright & Social */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Copyright className="h-5 w-5" />
                    Copyright & Social Media
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Footer copyright year and social media links
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="copyrightYear">Copyright Year</Label>
                    <Input
                      id="copyrightYear"
                      value={siteSettings.copyrightYear}
                      onChange={(e) => setSiteSettings({ ...siteSettings, copyrightYear: e.target.value })}
                      placeholder="2025"
                      data-testid="input-copyright-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagramHandle" className="flex items-center gap-2">
                      <Instagram className="h-4 w-4" />
                      Instagram Handle
                    </Label>
                    <Input
                      id="instagramHandle"
                      value={siteSettings.instagramHandle}
                      onChange={(e) => setSiteSettings({ ...siteSettings, instagramHandle: e.target.value })}
                      placeholder="wolfmothertulsa"
                      data-testid="input-instagram"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter without @: {siteSettings.instagramHandle && `@${siteSettings.instagramHandle}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}