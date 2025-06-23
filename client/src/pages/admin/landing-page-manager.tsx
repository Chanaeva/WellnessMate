import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LandingPageContent, InsertLandingPageContent, Promotion, InsertPromotion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit, Trash2, Save, X, Copy, Eye, Settings } from "lucide-react";
import { z } from "zod";

// Form schemas
const contentSchema = z.object({
  section: z.string().min(1, "Section is required"),
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  isActive: z.boolean().default(true),
});

const promotionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  code: z.string().min(1, "Code is required"),
  validUntil: z.string().min(1, "Valid until is required"),
  bgColor: z.string().default("bg-gradient-to-r from-amber-500 to-orange-600"),
  textColor: z.string().default("text-white"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export default function LandingPageManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<LandingPageContent | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Access denied. Admin privileges required.</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Fetch data
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["/api/admin/landing-content"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/landing-content");
      return await res.json() as LandingPageContent[];
    },
  });

  const { data: promotions, isLoading: promotionsLoading } = useQuery({
    queryKey: ["/api/admin/promotions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/promotions");
      return await res.json() as Promotion[];
    },
  });

  // Forms
  const contentForm = useForm({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      section: "",
      key: "",
      value: "",
      isActive: true,
    },
  });

  const promotionForm = useForm({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      title: "",
      description: "",
      code: "",
      validUntil: "",
      bgColor: "bg-gradient-to-r from-amber-500 to-orange-600",
      textColor: "text-white",
      isActive: true,
      sortOrder: 0,
    },
  });

  // Mutations
  const contentMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingContent 
        ? `/api/admin/landing-content/${editingContent.id}`
        : "/api/admin/landing-content";
      const method = editingContent ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/landing-content"] });
      toast({
        title: "Success",
        description: editingContent ? "Content updated successfully" : "Content created successfully",
      });
      resetContentForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const promotionMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingPromotion 
        ? `/api/admin/promotions/${editingPromotion.id}`
        : "/api/admin/promotions";
      const method = editingPromotion ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({
        title: "Success",
        description: editingPromotion ? "Promotion updated successfully" : "Promotion created successfully",
      });
      resetPromotionForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/landing-content/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/landing-content"] });
      toast({
        title: "Content Deleted",
        description: "Content item has been deleted successfully",
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

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/promotions/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({
        title: "Promotion Deleted",
        description: "Promotion has been deleted successfully",
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

  // Helper functions
  const resetContentForm = () => {
    setEditingContent(null);
    setIsContentDialogOpen(false);
    contentForm.reset();
  };

  const resetPromotionForm = () => {
    setEditingPromotion(null);
    setIsPromotionDialogOpen(false);
    promotionForm.reset();
  };

  const handleEditContent = (item: LandingPageContent) => {
    setEditingContent(item);
    contentForm.reset({
      section: item.section,
      key: item.key,
      value: item.value,
      isActive: item.isActive,
    });
    setIsContentDialogOpen(true);
  };

  const handleEditPromotion = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    promotionForm.reset({
      title: promotion.title,
      description: promotion.description,
      code: promotion.code,
      validUntil: promotion.validUntil,
      bgColor: promotion.bgColor,
      textColor: promotion.textColor,
      isActive: promotion.isActive,
      sortOrder: promotion.sortOrder,
    });
    setIsPromotionDialogOpen(true);
  };

  // Group content by section
  const contentBySection = content?.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, LandingPageContent[]>) || {};

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Landing Page Manager
          </h1>
          <p className="text-muted-foreground font-body">
            Manage landing page content and promotional offers
          </p>
        </div>

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Page Content</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
          </TabsList>

          {/* Page Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Landing Page Content</CardTitle>
                  <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingContent(null);
                        contentForm.reset();
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Content
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{editingContent ? 'Edit' : 'Add'} Content</DialogTitle>
                        <DialogDescription>
                          {editingContent 
                            ? 'Update the content item'
                            : 'Add a new content item to the landing page'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      
                      <Form {...contentForm}>
                        <form onSubmit={contentForm.handleSubmit((data) => contentMutation.mutate(data))} className="space-y-4">
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
                                    <SelectItem value="hero">Hero</SelectItem>
                                    <SelectItem value="features">Features</SelectItem>
                                    <SelectItem value="contact">Contact</SelectItem>
                                    <SelectItem value="footer">Footer</SelectItem>
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
                                  <Input placeholder="e.g., title, description" {...field} />
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
                                  <Textarea placeholder="Content value" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={contentForm.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Active</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Show this content on the landing page
                                  </div>
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
                          
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={resetContentForm}>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button type="submit" disabled={contentMutation.isPending}>
                              <Save className="h-4 w-4 mr-2" />
                              {editingContent ? 'Update' : 'Create'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {contentLoading ? (
                  <p className="text-center text-muted-foreground">Loading content...</p>
                ) : Object.keys(contentBySection).length === 0 ? (
                  <p className="text-center text-muted-foreground">No content items yet</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(contentBySection).map(([section, items]) => (
                      <div key={section}>
                        <h3 className="text-lg font-heading font-semibold mb-3 capitalize">{section}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Key</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-sm">{item.key}</TableCell>
                                <TableCell className="max-w-xs truncate">{item.value}</TableCell>
                                <TableCell>
                                  <Badge variant={item.isActive ? "default" : "secondary"}>
                                    {item.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEditContent(item)}>
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
                                          <AlertDialogTitle>Delete Content</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete this content item? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => deleteContentMutation.mutate(item.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Promotions Tab */}
          <TabsContent value="promotions" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Promotional Offers</CardTitle>
                  <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingPromotion(null);
                        promotionForm.reset();
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Promotion
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingPromotion ? 'Edit' : 'Add'} Promotion</DialogTitle>
                        <DialogDescription>
                          {editingPromotion 
                            ? 'Update the promotional offer'
                            : 'Create a new promotional offer for the landing page'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      
                      <Form {...promotionForm}>
                        <form onSubmit={promotionForm.handleSubmit((data) => promotionMutation.mutate(data))} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={promotionForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Title</FormLabel>
                                  <FormControl>
                                    <Input placeholder="New Member Special" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={promotionForm.control}
                              name="code"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Promo Code</FormLabel>
                                  <FormControl>
                                    <Input placeholder="WOLFPACK50" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={promotionForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input placeholder="50% off your first month" {...field} />
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
                                  <Input placeholder="End of June 2025" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={promotionForm.control}
                              name="bgColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Background Color</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="bg-gradient-to-r from-amber-500 to-orange-600">Amber/Orange</SelectItem>
                                      <SelectItem value="bg-gradient-to-r from-blue-500 to-purple-600">Blue/Purple</SelectItem>
                                      <SelectItem value="bg-gradient-to-r from-green-500 to-teal-600">Green/Teal</SelectItem>
                                      <SelectItem value="bg-gradient-to-r from-red-500 to-pink-600">Red/Pink</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={promotionForm.control}
                              name="sortOrder"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sort Order</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="0" 
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={promotionForm.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Active</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Show this promotion on the landing page
                                  </div>
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
                          
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={resetPromotionForm}>
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button type="submit" disabled={promotionMutation.isPending}>
                              <Save className="h-4 w-4 mr-2" />
                              {editingPromotion ? 'Update' : 'Create'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {promotionsLoading ? (
                  <p className="text-center text-muted-foreground">Loading promotions...</p>
                ) : !promotions?.length ? (
                  <p className="text-center text-muted-foreground">No promotions yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotions.map((promotion) => (
                        <TableRow key={promotion.id}>
                          <TableCell className="font-medium">{promotion.title}</TableCell>
                          <TableCell className="font-mono text-sm">{promotion.code}</TableCell>
                          <TableCell className="max-w-xs truncate">{promotion.description}</TableCell>
                          <TableCell>{promotion.validUntil}</TableCell>
                          <TableCell>
                            <Badge variant={promotion.isActive ? "default" : "secondary"}>
                              {promotion.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditPromotion(promotion)}>
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
                                    <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{promotion.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deletePromotionMutation.mutate(promotion.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
}