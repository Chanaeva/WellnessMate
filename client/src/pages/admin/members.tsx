import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  User,
  Membership,
  insertUserSchema,
  insertMembershipSchema,
  CheckIn,
  Payment,
  PunchCard,
} from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Search,
  Eye,
  Edit,
  QrCode,
  Download,
  ChevronLeft,
  ChevronRight,
  Archive,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Activity,
  AlertCircle,
  Ticket,
  Link2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

// Form schema for adding new member
const newMemberSchema = insertUserSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm password"),
    planType: z.enum(["basic", "premium", "vip", "daily"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Form schema for editing member
const editMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
  username: z.string().min(1, "Username is required"),
  role: z.enum(["member", "staff", "admin"]),
  // Membership fields
  membershipStatus: z.enum(["active", "inactive", "expired", "frozen"]).optional(),
  membershipPlanType: z.enum(["basic", "premium", "vip", "daily"]).optional(),
  membershipStartDate: z.string().optional(),
  membershipEndDate: z.string().optional(),
});

type NewMemberFormData = z.infer<typeof newMemberSchema>;
type EditMemberFormData = z.infer<typeof editMemberSchema>;

export default function AdminMembers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [isViewMemberOpen, setIsViewMemberOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<(User & { membership?: Membership }) | null>(null);
  const itemsPerPage = 10;

  // Form for adding new member
  const newMemberForm = useForm<NewMemberFormData>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      planType: "basic",
      role: "member",
    },
  });

  // Form for editing member
  const editMemberForm = useForm<EditMemberFormData>({
    resolver: zodResolver(editMemberSchema),
  });

  // Fetch members data
  const { data: members, isLoading } = useQuery<
    (User & { membership?: Membership })[]
  >({
    queryKey: ["/api/admin/members"],
    enabled: !!user && user.role === "admin",
  });

  // Fetch member's payment history
  const { data: memberPayments, isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: [`/api/admin/members/${selectedMember?.id}/payments`],
    enabled: !!selectedMember,
  });

  // Fetch member's check-in history
  const { data: memberCheckIns, isLoading: isLoadingCheckIns } = useQuery<CheckIn[]>({
    queryKey: [`/api/admin/members/${selectedMember?.id}/check-ins`],
    enabled: !!selectedMember,
  });

  // Add new member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: NewMemberFormData) => {
      const response = await apiRequest(
        "POST",
        "/api/admin/create-member",
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Added",
        description: "New member has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsAddMemberOpen(false);
      newMemberForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create member",
        variant: "destructive",
      });
    },
  });

  // Edit member mutation
  const editMemberMutation = useMutation({
    mutationFn: async (data: EditMemberFormData & { id: number }) => {
      const { id, membershipStatus, membershipPlanType, membershipStartDate, membershipEndDate, ...userData } = data;
      
      // Update user data
      await apiRequest("PUT", `/api/admin/members/${id}`, userData);
      
      // Update membership if it exists and any membership fields changed
      if (selectedMember?.membership?.id && (membershipStatus || membershipPlanType || membershipStartDate || membershipEndDate)) {
        const membershipUpdate: any = {};
        if (membershipStatus) membershipUpdate.status = membershipStatus;
        if (membershipPlanType) membershipUpdate.planType = membershipPlanType;
        if (membershipStartDate) membershipUpdate.startDate = membershipStartDate;
        if (membershipEndDate) membershipUpdate.endDate = membershipEndDate;
        
        // Use numeric membership ID, not membershipId string
        await apiRequest("PATCH", `/api/admin/memberships/${selectedMember.membership.id}`, membershipUpdate);
      }
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Member Updated",
        description: "Member details have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsEditMemberOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member",
        variant: "destructive",
      });
    },
  });

  // Archive member mutation (preserves all historical data)
  const archiveMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/members/${id}/archive`);
    },
    onSuccess: () => {
      toast({
        title: "Member Archived",
        description: "Member has been archived. All historical data is preserved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive member",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmitNewMember = (data: NewMemberFormData) => {
    addMemberMutation.mutate(data);
  };

  const onSubmitEditMember = (data: EditMemberFormData) => {
    if (selectedMember) {
      editMemberMutation.mutate({ ...data, id: selectedMember.id });
    }
  };

  // Handle view member
  const handleViewMember = (member: User & { membership?: Membership }) => {
    setSelectedMember(member);
    setIsViewMemberOpen(true);
  };

  // Handle edit member
  const handleEditMember = (member: User & { membership?: Membership }) => {
    setSelectedMember(member);
    editMemberForm.reset({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phoneNumber: member.phoneNumber || "",
      username: member.username,
      role: member.role as "member" | "staff" | "admin",
      membershipStatus: member.membership?.status as any,
      membershipPlanType: member.membership?.planType as any,
      membershipStartDate: member.membership?.startDate || "",
      membershipEndDate: member.membership?.endDate || "",
    });
    setIsEditMemberOpen(true);
  };

  // Handle archive member
  const handleArchiveMember = (member: User & { membership?: Membership }) => {
    setSelectedMember(member);
    setIsDeleteDialogOpen(true);
  };

  const confirmArchive = () => {
    if (selectedMember) {
      archiveMemberMutation.mutate(selectedMember.id);
    }
  };

  // Filter and search members (exclude archived)
  const filteredMembers =
    members?.filter((member) => {
      // Exclude archived members
      if ((member as any).isArchived) return false;
      
      // Apply search filter
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const email = member.email.toLowerCase();
      const membershipId = member.membership?.membershipId?.toLowerCase() || "";
      const searchLower = searchQuery.toLowerCase();

      const matchesSearch =
        !searchQuery ||
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        membershipId.includes(searchLower);

      // Apply status filter
      const matchesStatus =
        statusFilter === "all" || member.membership?.status === statusFilter;

      // Apply plan filter
      const matchesPlan =
        planFilter === "all" || member.membership?.planType === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const currentMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <CardTitle className="text-xl font-bold">
            Member Management
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={isAddMemberOpen}
              onOpenChange={setIsAddMemberOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-member">
                  <UserPlus className="mr-2 h-4 w-4" /> Add New Member
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <Form {...newMemberForm}>
                <form
                  onSubmit={newMemberForm.handleSubmit(onSubmitNewMember)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={newMemberForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newMemberForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={newMemberForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newMemberForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe" {...field} data-testid="input-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={newMemberForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newMemberForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-confirm-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={newMemberForm.control}
                    name="planType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Plan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-plan-type">
                              <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="premium">
                              Premium
                            </SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                            <SelectItem value="daily">
                              Daily Pass
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddMemberOpen(false)}
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      data-testid="button-submit-add"
                    >
                      {addMemberMutation.isPending
                        ? "Creating..."
                        : "Create Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or member ID"
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-members"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                </SelectContent>
              </Select>

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-plan-filter">
                  <SelectValue placeholder="Plan Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="flex items-center" data-testid="button-export">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading members...</p>
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Member
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {" "}
                      ID
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Plan
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      End Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentMembers.map((member, index) => (
                    <tr
                      key={member.id}
                      className={index % 2 === 1 ? "bg-gray-50" : ""}
                      data-testid={`row-member-${member.id}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900" data-testid={`text-member-name-${member.id}`}>
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500" data-testid={`text-member-email-${member.id}`}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid={`text-membership-id-${member.id}`}>
                        {member.membership?.membershipId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          className={
                            member.membership?.status === "active"
                              ? "bg-green-100 text-green-800"
                              : member.membership?.status === "inactive"
                                ? "bg-red-100 text-red-800"
                                : member.membership?.status === "expired"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : member.membership?.status === "frozen"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                          }
                          data-testid={`badge-status-${member.id}`}
                        >
                          {member.membership?.status
                            ? member.membership.status
                                .charAt(0)
                                .toUpperCase() +
                              member.membership.status.slice(1)
                            : "No Membership"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize" data-testid={`text-plan-type-${member.id}`}>
                        {member.membership?.planType || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid={`text-end-date-${member.id}`}>
                        {member.membership?.endDate
                          ? format(
                              new Date(member.membership.endDate),
                              "MMM d, yyyy",
                            )
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                            title="View Profile"
                            onClick={() => handleViewMember(member)}
                            data-testid={`button-view-${member.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-secondary hover:text-secondary/80 h-8 w-8 p-0"
                            title="Edit Member"
                            onClick={() => handleEditMember(member)}
                            data-testid={`button-edit-${member.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 h-8 w-8 p-0"
                            title="Archive Member"
                            onClick={() => handleArchiveMember(member)}
                            data-testid={`button-archive-${member.id}`}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 hover:text-purple-700 h-8 w-8 p-0"
                            title="Copy Claim Account Link"
                            onClick={() => {
                              const claimUrl = `${window.location.origin}/claim-account`;
                              navigator.clipboard.writeText(claimUrl);
                              toast({
                                title: "Link Copied",
                                description: "Claim account link copied to clipboard",
                              });
                            }}
                            data-testid={`button-claim-link-${member.id}`}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-4 text-gray-400"
              >
                <path d="M17.5 8A6.5 6.5 0 0 0 4.5 8c0 1.7.75 3.25 2 4.32"></path>
                <path d="M19.5 15.5c0-2.37-2.54-3-3.5-3-1.32 0-3.5.67-3.5 3"></path>
                <circle cx="10" cy="9" r="2"></circle>
                <circle cx="16" cy="9" r="2"></circle>
                <path d="M18.5 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"></path>
                <path d="m16.5 15.5 4 4"></path>
                <path d="M7 13c-2.42 0-5 1.58-5 4"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900">
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}

          {/* Pagination */}
          {filteredMembers.length > 0 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(
                  currentPage * itemsPerPage,
                  filteredMembers.length,
                )}{" "}
                of {filteredMembers.length} members
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  data-testid="button-prev-page"
                >
                  <span className="sr-only">Previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center">
                  {Array.from(
                    { length: Math.min(5, totalPages) },
                    (_, i) => {
                      const pageNumber =
                        i + 1 + Math.max(0, currentPage - 3);
                      if (pageNumber <= totalPages) {
                        return (
                          <Button
                            key={pageNumber}
                            variant={
                              currentPage === pageNumber
                                ? "default"
                                : "outline"
                            }
                            className="mx-1 h-8 w-8 p-0"
                            onClick={() => setCurrentPage(pageNumber)}
                            disabled={currentPage === pageNumber}
                            data-testid={`button-page-${pageNumber}`}
                          >
                            {pageNumber}
                          </Button>
                        );
                      }
                      return null;
                    },
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  data-testid="button-next-page"
                >
                  <span className="sr-only">Next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Member Dialog */}
      <Dialog open={isViewMemberOpen} onOpenChange={setIsViewMemberOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
            <DialogDescription>
              Viewing information for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedMember && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
                <TabsTrigger value="checkins" data-testid="tab-checkins">Check-ins</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4" data-testid="tab-content-overview">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Full Name</h4>
                    <p className="text-sm" data-testid="text-view-full-name">{selectedMember.firstName} {selectedMember.lastName}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                    <p className="text-sm flex items-center" data-testid="text-view-email">
                      <Mail className="h-4 w-4 mr-1" />
                      {selectedMember.email}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Phone</h4>
                    <p className="text-sm flex items-center" data-testid="text-view-phone">
                      <Phone className="h-4 w-4 mr-1" />
                      {selectedMember.phoneNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Role</h4>
                    <Badge variant="outline" data-testid="badge-view-role">{selectedMember.role}</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Membership Information
                  </h4>
                  {selectedMember.membership ? (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Membership ID</h5>
                        <p className="text-sm font-mono" data-testid="text-view-membership-id">{selectedMember.membership.membershipId}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Status</h5>
                        <Badge
                          className={
                            selectedMember.membership.status === "active"
                              ? "bg-green-100 text-green-800"
                              : selectedMember.membership.status === "inactive"
                                ? "bg-red-100 text-red-800"
                                : selectedMember.membership.status === "expired"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-blue-100 text-blue-800"
                          }
                          data-testid="badge-view-membership-status"
                        >
                          {selectedMember.membership.status}
                        </Badge>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Plan Type</h5>
                        <p className="text-sm capitalize" data-testid="text-view-membership-plan">{selectedMember.membership.planType}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Auto Renew</h5>
                        <Badge variant={selectedMember.membership.autoRenew ? "default" : "secondary"} data-testid="badge-view-auto-renew">
                          {selectedMember.membership.autoRenew ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Start Date</h5>
                        <p className="text-sm" data-testid="text-view-start-date">
                          {selectedMember.membership.startDate
                            ? format(new Date(selectedMember.membership.startDate), "MMM d, yyyy")
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">End Date</h5>
                        <p className="text-sm" data-testid="text-view-end-date">
                          {selectedMember.membership.endDate
                            ? format(new Date(selectedMember.membership.endDate), "MMM d, yyyy")
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No active membership</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Membership Agreement
                  </h4>
                  {selectedMember.membershipAgreementCompleted ? (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">Agreement Signed</p>
                          <p className="text-xs text-green-600">
                            {selectedMember.membershipAgreementDate 
                              ? `Signed on ${format(new Date(selectedMember.membershipAgreementDate), "MMM d, yyyy")}`
                              : "Agreement completed"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(`/api/admin/members/${selectedMember.id}/agreement-pdf`, '_blank');
                          }}
                          data-testid="btn-download-agreement"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                      <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm text-yellow-800">No membership agreement on file</p>
                      <p className="text-xs text-yellow-600">Member has not signed the membership agreement yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4" data-testid="tab-content-payments">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Payment History</h4>
                  {isLoadingPayments ? (
                    <div className="bg-gray-50 p-8 rounded-lg text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading payments...</p>
                    </div>
                  ) : memberPayments && memberPayments.length > 0 ? (
                    <div className="space-y-2">
                      {memberPayments.map((payment) => (
                        <div key={payment.id} className="border rounded-lg p-3 hover:bg-gray-50" data-testid={`payment-record-${payment.id}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium" data-testid={`text-payment-description-${payment.id}`}>{payment.description}</p>
                              <p className="text-xs text-gray-500" data-testid={`text-payment-date-${payment.id}`}>
                                {payment.transactionDate
                                  ? format(new Date(payment.transactionDate), "MMM d, yyyy 'at' h:mm a")
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium" data-testid={`text-payment-amount-${payment.id}`}>{formatPrice(payment.amount)}</p>
                              <Badge
                                variant={payment.status === "successful" ? "default" : "destructive"}
                                className="text-xs"
                                data-testid={`badge-payment-status-${payment.id}`}
                              >
                                {payment.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-8 rounded-lg text-center">
                      <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No payment history</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="checkins" className="space-y-4" data-testid="tab-content-checkins">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Check-in History</h4>
                  {isLoadingCheckIns ? (
                    <div className="bg-gray-50 p-8 rounded-lg text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading check-ins...</p>
                    </div>
                  ) : memberCheckIns && memberCheckIns.length > 0 ? (
                    <div className="space-y-2">
                      {memberCheckIns.map((checkIn) => (
                        <div key={checkIn.id} className="border rounded-lg p-3 hover:bg-gray-50" data-testid={`checkin-record-${checkIn.id}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium flex items-center" data-testid={`text-checkin-location-${checkIn.id}`}>
                                <Activity className="h-4 w-4 mr-2" />
                                {checkIn.location || "Main Entrance"}
                              </p>
                              <p className="text-xs text-gray-500" data-testid={`text-checkin-date-${checkIn.id}`}>
                                {checkIn.timestamp
                                  ? format(new Date(checkIn.timestamp), "MMM d, yyyy 'at' h:mm a")
                                  : "N/A"}
                              </p>
                            </div>
                            <Badge variant="outline" data-testid={`badge-checkin-method-${checkIn.id}`}>{checkIn.method}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-8 rounded-lg text-center">
                      <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No check-in history</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewMemberOpen(false)}
              data-testid="button-close-view"
            >
              Close
            </Button>
            {selectedMember && (
              <Button
                onClick={() => {
                  setIsViewMemberOpen(false);
                  handleEditMember(selectedMember);
                }}
                data-testid="button-edit-from-view"
              >
                Edit Member
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update member information and membership details
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editMemberForm}>
            <form onSubmit={editMemberForm.handleSubmit(onSubmitEditMember)} className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editMemberForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editMemberForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editMemberForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={editMemberForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editMemberForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} data-testid="input-edit-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    control={editMemberForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Membership Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editMemberForm.control}
                    name="membershipStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-membership-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="frozen">Frozen</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editMemberForm.control}
                    name="membershipPlanType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-membership-plan">
                              <SelectValue placeholder="Select plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={editMemberForm.control}
                    name="membershipStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-edit-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editMemberForm.control}
                    name="membershipEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-edit-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditMemberOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMemberMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {editMemberMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-archive-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedMember?.membership?.status === 'active' 
                ? "Warning: Active Membership" 
                : "Archive Member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.membership?.status === 'active' ? (
                <>
                  <strong className="text-amber-600">This member has an active membership!</strong>
                  <br /><br />
                  Archiving <strong>{selectedMember?.firstName} {selectedMember?.lastName}</strong> will hide them from the active member list. All historical data (check-ins, payments, membership) will be preserved.
                </>
              ) : (
                <>
                  This will archive <strong>{selectedMember?.firstName} {selectedMember?.lastName}</strong> and hide them from the active member list. All historical data will be preserved and can be accessed later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-archive"
            >
              {archiveMemberMutation.isPending ? "Archiving..." : "Archive Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
