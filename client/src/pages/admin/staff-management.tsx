import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, createStaffAdminSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserPlus, Shield, Users, Pencil, Trash2, History, CheckCircle, XCircle } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";

type LoginEvent = {
  id: number;
  userId: number;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  wasSuccessful: boolean;
  user?: Partial<User>;
};

const updateStaffSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(['staff', 'admin']).optional(),
  password: z.string().min(6).optional().or(z.literal('')),
});

export default function AdminStaffManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: staffAdminUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.role === 'admin',
  });

  const { data: loginEvents = [], isLoading: isLoadingEvents } = useQuery<LoginEvent[]>({
    queryKey: ["/api/admin/login-events"],
    enabled: !!user && user.role === 'admin',
  });

  const createForm = useForm({
    resolver: zodResolver(createStaffAdminSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "staff" as const,
      phoneNumber: "",
    },
  });

  const editForm = useForm<z.infer<typeof updateStaffSchema>>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      role: "staff",
      password: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Created",
        description: "Staff/Admin account has been created. They will set their password on first login.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const cleanData = { ...data };
      if (!cleanData.password) delete cleanData.password;
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, cleanData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Updated",
        description: "Staff/Admin account has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Staff/Admin account has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (staffUser: User) => {
    setSelectedUser(staffUser);
    const role = staffUser.role === 'admin' ? 'admin' : 'staff';
    editForm.reset({
      email: staffUser.email,
      firstName: staffUser.firstName,
      lastName: staffUser.lastName,
      phoneNumber: staffUser.phoneNumber || "",
      role: role as 'staff' | 'admin',
      password: "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (staffUser: User) => {
    setSelectedUser(staffUser);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: any) => {
    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data });
    }
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteMutation.mutate(selectedUser.id);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Unauthorized. Admin access required.</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Staff & Admin Management</h1>
              <p className="text-muted-foreground mt-2">
                Create and manage staff and admin accounts
              </p>
            </div>
            <Link href="/admin">
              <Button variant="outline">Back to Admin</Button>
            </Link>
          </div>

          <Tabs defaultValue="accounts" className="space-y-4">
            <TabsList>
              <TabsTrigger value="accounts" data-testid="tab-accounts">
                <Users className="mr-2 h-4 w-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="login-history" data-testid="tab-login-history">
                <History className="mr-2 h-4 w-4" />
                Login History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-xl">Staff & Admin Accounts</CardTitle>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-staff-admin">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Create Staff or Admin Account</DialogTitle>
                        <DialogDescription>
                          Create a new account. The user will set their own password on first login.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                          <FormField
                            control={createForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="email"
                                    placeholder="user@example.com"
                                    data-testid="input-email"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={createForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="John" data-testid="input-first-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={createForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Doe" data-testid="input-last-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={createForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Role</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-role">
                                      <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="staff" data-testid="option-staff">Staff</SelectItem>
                                    <SelectItem value="admin" data-testid="option-admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={createForm.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number (Optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="tel"
                                    placeholder="555-123-4567"
                                    data-testid="input-phone"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={createForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Temporary Password</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="password"
                                    placeholder="Temporary password"
                                    data-testid="input-password"
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
                              data-testid="button-cancel"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={createMutation.isPending}
                              data-testid="button-submit"
                            >
                              {createMutation.isPending ? "Creating..." : "Create Account"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : staffAdminUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No staff or admin accounts found.</p>
                      <p className="text-sm mt-2">Create your first account to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Last Login</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffAdminUsers.map((staffUser) => (
                            <TableRow key={staffUser.id} data-testid={`row-user-${staffUser.id}`}>
                              <TableCell className="font-medium">
                                {staffUser.firstName} {staffUser.lastName}
                                {staffUser.mustChangePassword && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Pending Password
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell data-testid={`email-${staffUser.id}`}>
                                {staffUser.email}
                              </TableCell>
                              <TableCell>{staffUser.phoneNumber || '—'}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={staffUser.role === 'admin' ? 'default' : 'secondary'}
                                  data-testid={`badge-role-${staffUser.id}`}
                                >
                                  {staffUser.role === 'admin' ? (
                                    <Shield className="mr-1 h-3 w-3" />
                                  ) : null}
                                  {staffUser.role.charAt(0).toUpperCase() + staffUser.role.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {staffUser.lastLoginAt 
                                  ? new Date(staffUser.lastLoginAt).toLocaleString()
                                  : 'Never'
                                }
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(staffUser)}
                                    data-testid={`button-edit-${staffUser.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(staffUser)}
                                    disabled={staffUser.id === user?.id}
                                    data-testid={`button-delete-${staffUser.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
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

            <TabsContent value="login-history">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Staff Login History</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingEvents ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : loginEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>No login history found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>IP Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loginEvents.map((event) => (
                            <TableRow key={event.id} data-testid={`row-login-${event.id}`}>
                              <TableCell className="font-medium">
                                {event.user?.firstName} {event.user?.lastName}
                                <div className="text-xs text-muted-foreground">
                                  {event.user?.email}
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(event.occurredAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {event.wasSuccessful ? (
                                  <Badge variant="default" className="bg-green-600">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Success
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Failed
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {event.ipAddress || '—'}
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

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Staff Account</DialogTitle>
                <DialogDescription>
                  Update account details. Leave password blank to keep current password.
                </DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            data-testid="edit-input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="edit-input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="edit-input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="edit-select-role">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            data-testid="edit-input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Leave blank to keep current"
                            data-testid="edit-input-password"
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
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      data-testid="button-update-submit"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the account for {selectedUser?.firstName} {selectedUser?.lastName}?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}
