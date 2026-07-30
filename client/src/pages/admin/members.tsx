import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  User,
  Membership,
  MembershipPlan,
  insertUserSchema,
  insertMembershipSchema,
  CheckIn,
  Payment,
  PunchCard,
  PaymentMethod,
  GuestWaiver,
} from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Key,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { AdminAddPaymentMethod } from "@/components/payment/admin-add-payment-method";

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
  const [showArchived, setShowArchived] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);
  const [isViewMemberOpen, setIsViewMemberOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelMembershipOpen, setIsCancelMembershipOpen] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedMember, setSelectedMember] = useState<(User & { membership?: Membership }) | null>(null);
  const [isAddPaymentMethodOpen, setIsAddPaymentMethodOpen] = useState(false);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const [paymentMethodClientSecret, setPaymentMethodClientSecret] = useState<string | null>(null);
  const [isCreateMembershipOpen, setIsCreateMembershipOpen] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState<string>("");
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"members" | "guests">("members");
  const [selectedGuest, setSelectedGuest] = useState<(User & { visitCount: number }) | null>(null);
  const [isViewGuestOpen, setIsViewGuestOpen] = useState(false);
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [linkStripeInput, setLinkStripeInput] = useState("");
  const [linkStripeStatus, setLinkStripeStatus] = useState<{ type: "success" | "warning" | "error"; message: string; emailMismatch?: boolean; stripeCustomerId?: string; stripeEmail?: string } | null>(null);
  const [linkStripeMode, setLinkStripeMode] = useState<"id" | "email">("id");
  const [linkStripeEmailSearch, setLinkStripeEmailSearch] = useState("");
  const [linkStripeSearchResults, setLinkStripeSearchResults] = useState<{ id: string; email: string; name: string | null; created: number }[]>([]);
  const [linkStripeSearching, setLinkStripeSearching] = useState(false);
  type SyncResultRow = { membershipId: string; email: string; oldStatus: string; newStatus: string; action: string };
  type SyncLinkedRow = { email: string; subscriptionId: string; newStatus: string };
  type SyncErrorRow = { membershipId: string; email: string; error: string };
  type SyncResults = {
    checked: number;
    updated: number;
    newlyLinked: number;
    newlyLinkedDetails: SyncLinkedRow[];
    errors: number;
    results: SyncResultRow[];
    errorDetails: SyncErrorRow[];
  };
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
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

  // Fetch guests data
  const { data: guests, isLoading: isLoadingGuests } = useQuery<
    (User & { visitCount: number })[]
  >({
    queryKey: ["/api/admin/guests"],
    enabled: !!user && user.role === "admin",
  });

  // Fetch selected guest's waiver history
  const { data: guestWaivers, isLoading: isLoadingGuestWaivers } = useQuery<GuestWaiver[]>({
    queryKey: ["/api/admin/guests", selectedGuest?.id, "waivers"],
    queryFn: async () => {
      if (!selectedGuest?.id) return [];
      const response = await fetch(`/api/admin/guests/${selectedGuest.id}/waivers`);
      if (!response.ok) throw new Error("Failed to fetch guest waivers");
      return response.json();
    },
    enabled: !!selectedGuest && isViewGuestOpen,
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

  // Fetch member's payment methods
  const { data: memberPaymentMethods, isLoading: isLoadingPaymentMethods, refetch: refetchPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['/api/admin/members', selectedMember?.id, 'payment-methods'],
    queryFn: async () => {
      if (!selectedMember?.id) return [];
      const response = await fetch(`/api/admin/members/${selectedMember.id}/payment-methods`);
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      return response.json();
    },
    enabled: !!selectedMember,
  });

  // Fetch membership plans for creating memberships
  const { data: membershipPlans = [] } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/membership-plans"],
  });

  // Create membership mutation
  const createMembershipMutation = useMutation({
    mutationFn: async ({ userId, planType }: { userId: number; planType: string }) => {
      const response = await apiRequest("POST", `/api/admin/members/${userId}/membership`, { planType });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Membership Created",
        description: data.subscriptionId 
          ? `Membership created with subscription. Next billing: ${data.nextBillingDate}`
          : "Membership created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsCreateMembershipOpen(false);
      setSelectedPlanType("");
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Membership",
        description: error.message || "Failed to create membership",
        variant: "destructive",
      });
    },
  });

  // Remove membership mutation
  const removeMembershipMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/memberships/${membershipId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Removed",
        description: "Membership has been removed from this member.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error Removing Membership",
        description: error.message || "Failed to remove membership",
        variant: "destructive",
      });
    },
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
      
      // Update user data first
      await apiRequest("PUT", `/api/admin/members/${id}`, userData);
      
      // Only update membership if member actually has one and fields have values
      if (selectedMember?.membership?.id) {
        const membershipUpdate: any = {};
        if (membershipStatus) membershipUpdate.status = membershipStatus;
        if (membershipPlanType) membershipUpdate.planType = membershipPlanType;
        if (membershipStartDate) membershipUpdate.startDate = membershipStartDate;
        if (membershipEndDate) membershipUpdate.endDate = membershipEndDate;
        
        // Only make the request if there are actual updates
        if (Object.keys(membershipUpdate).length > 0) {
          try {
            await apiRequest("PATCH", `/api/admin/memberships/${selectedMember.membership.membershipId}`, membershipUpdate);
          } catch (error) {
            // Log but don't fail the whole operation if membership update fails
            console.warn("Membership update failed, member data was updated successfully");
          }
        }
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

  // Link Stripe customer mutation
  const linkStripeCustomerMutation = useMutation({
    mutationFn: async ({ memberId, stripeCustomerId, force }: { memberId: number; stripeCustomerId: string; force?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/link-stripe-customer`, { stripeCustomerId, force });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: (data) => {
      setLinkStripeStatus({
        type: "success",
        message: data.message,
      });
      // Update selectedMember so "Currently linked" reflects the new ID immediately
      if (data.stripeCustomerId) {
        setSelectedMember((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, stripeCustomerId: data.stripeCustomerId };
          // Also patch the membership subscription ID if one was auto-linked
          if (data.autoLinkedSubscriptionId && updated.membership) {
            updated.membership = {
              ...updated.membership,
              stripeSubscriptionId: data.autoLinkedSubscriptionId,
            };
          }
          return updated;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
    },
    onError: (error: any) => {
      if (error?.emailMismatch) {
        setLinkStripeStatus({
          type: "error",
          message: error.message,
          emailMismatch: true,
          stripeCustomerId: error.stripeCustomerId,
          stripeEmail: error.stripeEmail,
        });
      } else {
        setLinkStripeStatus({ type: "error", message: error.message || "Failed to link Stripe customer" });
      }
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

  // SMS send mutation
  const sendSmsMutation = useMutation({
    mutationFn: async ({ userId, message }: { userId: number; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/sms/send", { userId, message });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SMS Sent", description: "Message delivered successfully." });
      setSmsMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send SMS.", variant: "destructive" });
    },
  });

  // Handle view member
  const handleViewMember = (member: User & { membership?: Membership }) => {
    setSelectedMember(member);
    setIsViewMemberOpen(true);
    setSmsMessage("");
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
    setLinkStripeInput("");
    setLinkStripeStatus(null);
    setLinkStripeMode("id");
    setLinkStripeEmailSearch("");
    setLinkStripeSearchResults([]);
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

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      await apiRequest("PUT", `/api/admin/members/${userId}`, { password });
    },
    onSuccess: () => {
      toast({
        title: "Password Reset",
        description: "Member's password has been successfully reset.",
      });
      setIsResetPasswordOpen(false);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // Unarchive member mutation
  const unarchiveMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/members/${id}/unarchive`);
    },
    onSuccess: () => {
      toast({
        title: "Member Restored",
        description: "Member has been restored from archive.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore member",
        variant: "destructive",
      });
    },
  });

  // Create subscription for membership without one
  const createSubscriptionMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await apiRequest("POST", `/api/admin/memberships/${membershipId}/create-subscription`);
      const data = await response.json();
      if (!response.ok) throw data;
      return data;
    },
    onSuccess: (data) => {
      const isLinked = data.linkedExisting;
      toast({
        title: isLinked ? "Subscription Linked" : "Subscription Created",
        description: isLinked
          ? `Existing Stripe subscription was linked to this membership.${data.nextBillingDate ? ` Next billing: ${data.nextBillingDate}` : ''}`
          : `Subscription created successfully.${data.nextBillingDate ? ` Next billing: ${data.nextBillingDate}` : ''}`,
      });
      // Patch selectedMember immediately so the UI reflects the new subscription ID
      if (data.subscriptionId) {
        setSelectedMember((prev) => {
          if (!prev?.membership) return prev;
          return {
            ...prev,
            membership: { ...prev.membership, stripeSubscriptionId: data.subscriptionId },
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link or create subscription. The member may need to add a payment method first.",
        variant: "destructive",
      });
    },
  });

  // Add payment method for member
  const handleAddPaymentMethod = async () => {
    if (!selectedMember) return;
    
    setAddingPaymentMethod(true);
    try {
      // Get setup intent from server
      const response = await apiRequest("POST", `/api/admin/members/${selectedMember.id}/setup-intent`);
      const { clientSecret } = await response.json();
      
      setPaymentMethodClientSecret(clientSecret);
      setIsAddPaymentMethodOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment method setup",
        variant: "destructive",
      });
    } finally {
      setAddingPaymentMethod(false);
    }
  };

  const handlePaymentMethodSuccess = () => {
    setIsAddPaymentMethodOpen(false);
    setPaymentMethodClientSecret(null);
    refetchPaymentMethods();
    toast({
      title: "Payment Method Added",
      description: "The card has been added to this member's account.",
    });
  };

  const handlePaymentMethodCancel = () => {
    setIsAddPaymentMethodOpen(false);
    setPaymentMethodClientSecret(null);
  };

  // Cancel membership mutation
  const cancelMembershipMutation = useMutation({
    mutationFn: async ({ membershipId, cancelImmediately, reason }: { membershipId: string; cancelImmediately: boolean; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/memberships/${membershipId}/cancel`, {
        cancelImmediately,
        reason,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Membership Cancelled",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      setIsCancelMembershipOpen(false);
      setCancelImmediately(false);
      setCancelReason("");
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error Cancelling Membership",
        description: error.message || "Failed to cancel membership",
        variant: "destructive",
      });
    },
  });

  // Handle cancel membership
  const handleCancelMembership = (member: User & { membership?: Membership }) => {
    if (!member.membership) {
      toast({
        title: "No Membership",
        description: "This member doesn't have an active membership to cancel.",
        variant: "destructive",
      });
      return;
    }
    setSelectedMember(member);
    setIsCancelMembershipOpen(true);
  };

  const confirmCancelMembership = () => {
    if (selectedMember?.membership) {
      cancelMembershipMutation.mutate({
        membershipId: selectedMember.membership.membershipId,
        cancelImmediately,
        reason: cancelReason,
      });
    }
  };

  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/sync-stripe-memberships");
      return response.json();
    },
    onSuccess: (data) => {
      setSyncResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      const parts = [`Checked ${data.checked} memberships, updated ${data.updated}.`];
      if (data.newlyLinked > 0) parts.push(`${data.newlyLinked} new subscription${data.newlyLinked > 1 ? 's' : ''} linked.`);
      if (data.errors > 0) parts.push(`${data.errors} errors.`);
      toast({
        title: "Sync Complete",
        description: parts.join(' '),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync memberships with Stripe",
        variant: "destructive",
      });
    },
  });

  // Filter and search members
  const filteredMembers =
    members?.filter((member) => {
      // Handle archived filter
      const isArchived = (member as any).isArchived;
      if (!showArchived && isArchived) return false;
      if (showArchived && !isArchived) return false;
      
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
            {activeMainTab === "members" && (
            <>
            {/* Stripe Sync Button */}
            <Button
              variant="outline"
              onClick={() => { setSyncResults(null); setIsSyncDialogOpen(true); }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Sync with Stripe
            </Button>

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
            </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Main tab switch: Members / Guests */}
          <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as "members" | "guests")} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="guests">
                Guests
                {guests && guests.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-medium px-1.5 py-0.5">
                    {guests.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

          <TabsContent value="members">
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
              
              <Button 
                variant={showArchived ? "default" : "outline"} 
                className={`flex items-center ${showArchived ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                onClick={() => setShowArchived(!showArchived)}
                data-testid="button-toggle-archived"
              >
                <Archive className="mr-2 h-4 w-4" /> 
                {showArchived ? "Viewing Archived" : "Show Archived"}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading members...</p>
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Member
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                    >
                      Plan
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell"
                    >
                      End Date
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell"
                    >
                      Subscription
                    </th>
                    <th
                      scope="col"
                      className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary text-white flex items-center justify-center font-medium text-xs md:text-sm">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </div>
                          <div className="ml-2 md:ml-3">
                            <div className="text-sm font-medium text-gray-900" data-testid={`text-member-name-${member.id}`}>
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[120px] md:max-w-none" data-testid={`text-member-email-${member.id}`}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-gray-900 hidden sm:table-cell" data-testid={`text-membership-id-${member.id}`}>
                        {member.membership?.membershipId || "N/A"}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
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
                            : "None"}
                        </Badge>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-gray-900 capitalize hidden md:table-cell" data-testid={`text-plan-type-${member.id}`}>
                        {member.membership?.planType || "N/A"}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-gray-900 hidden lg:table-cell" data-testid={`text-end-date-${member.id}`}>
                        {member.membership?.endDate
                          ? format(
                              new Date(member.membership.endDate + 'T12:00:00'),
                              "MMM d, yyyy",
                            )
                          : "N/A"}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                        {member.membership?.stripeSubscriptionId ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className={member.membership.autoRenew ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                              {member.membership.autoRenew ? "Active" : "Cancelled"}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No subscription</span>
                        )}
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-1 md:space-x-2">
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
                            className="text-blue-600 hover:text-blue-700 h-8 w-8 p-0"
                            title="Reset Password"
                            onClick={() => {
                              setSelectedMember(member);
                              setIsResetPasswordOpen(true);
                            }}
                            data-testid={`button-reset-password-${member.id}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {(member as any).isArchived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 h-8 w-8 p-0"
                              title="Restore Member"
                              onClick={() => unarchiveMemberMutation.mutate(member.id)}
                              data-testid={`button-unarchive-${member.id}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              {member.membership && member.membership.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                                  title="Cancel Membership"
                                  onClick={() => handleCancelMembership(member)}
                                  data-testid={`button-cancel-membership-${member.id}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
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
                            </>
                          )}
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
          </TabsContent>

          {/* Guests Tab */}
          <TabsContent value="guests">
            {/* Guest search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search guests by name or email"
                  className="pl-10"
                  value={guestSearchQuery}
                  onChange={(e) => setGuestSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {isLoadingGuests ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading guests...</p>
              </div>
            ) : (() => {
              const filteredGuests = (guests || []).filter((g) => {
                if (!guestSearchQuery) return true;
                const q = guestSearchQuery.toLowerCase();
                return (
                  `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
                  g.email.toLowerCase().includes(q)
                );
              });
              return filteredGuests.length > 0 ? (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visits</th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredGuests.map((guest, index) => (
                        <tr key={guest.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-medium text-xs md:text-sm">
                                {guest.firstName.charAt(0)}{guest.lastName.charAt(0)}
                              </div>
                              <div className="ml-2 md:ml-3">
                                <div className="text-sm font-medium text-gray-900">{guest.firstName} {guest.lastName}</div>
                                <div className="text-xs text-gray-500 sm:hidden truncate max-w-[140px]">{guest.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap text-gray-600 text-sm hidden sm:table-cell">{guest.email}</td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                            <Badge className="bg-purple-100 text-purple-700">{guest.visitCount} {guest.visitCount === 1 ? "visit" : "visits"}</Badge>
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                              title="View Waiver History"
                              onClick={() => { setSelectedGuest(guest); setIsViewGuestOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900">No guests found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {guestSearchQuery ? "Try adjusting your search" : "No guest visitors have been recorded yet"}
                  </p>
                </div>
              );
            })()}
          </TabsContent>

          </Tabs>
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
                            ? format(new Date(selectedMember.membership.startDate + 'T12:00:00'), "MMM d, yyyy")
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-1">End Date</h5>
                        <p className="text-sm" data-testid="text-view-end-date">
                          {selectedMember.membership.endDate
                            ? format(new Date(selectedMember.membership.endDate + 'T12:00:00'), "MMM d, yyyy")
                            : "N/A"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <h5 className="text-xs font-medium text-gray-500 mb-1">Stripe Subscription</h5>
                        {selectedMember.membership.stripeSubscriptionId ? (
                          <Badge className="bg-green-100 text-green-800">
                            Active: {selectedMember.membership.stripeSubscriptionId.slice(0, 20)}...
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-100 text-yellow-800">No Subscription</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => createSubscriptionMutation.mutate(selectedMember.membership!.membershipId)}
                              disabled={createSubscriptionMutation.isPending}
                            >
                              {createSubscriptionMutation.isPending ? "Creating..." : "Create Subscription"}
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 pt-2 border-t mt-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${selectedMember.firstName}'s membership? This will also cancel any active subscription.`)) {
                              removeMembershipMutation.mutate(selectedMember.membership!.membershipId);
                            }
                          }}
                          disabled={removeMembershipMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {removeMembershipMutation.isPending ? "Removing..." : "Remove Membership"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-3">No active membership</p>
                      {memberPaymentMethods && memberPaymentMethods.length > 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPlanType("");
                            setIsCreateMembershipOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Membership
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">Add a payment method first to create a membership</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleAddPaymentMethod}
                            disabled={addingPaymentMethod}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            {addingPaymentMethod ? "Setting up..." : "Add Payment Method"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Stripe Status */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Stripe Status
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {/* Customer row */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedMember.stripeCustomerId ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700">Stripe Customer</p>
                          {selectedMember.stripeCustomerId ? (
                            <p className="text-xs text-gray-500 font-mono truncate">{selectedMember.stripeCustomerId}</p>
                          ) : (
                            <p className="text-xs text-gray-400">Not linked — will be created automatically next time a payment method is added</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subscription row */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedMember.membership?.stripeSubscriptionId ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700">Stripe Subscription</p>
                          {selectedMember.membership?.stripeSubscriptionId ? (
                            <p className="text-xs text-gray-500 font-mono truncate">{selectedMember.membership.stripeSubscriptionId}</p>
                          ) : selectedMember.membership ? (
                            <p className="text-xs text-gray-400">
                              {selectedMember.stripeCustomerId
                                ? memberPaymentMethods && memberPaymentMethods.length > 0
                                  ? 'Customer linked but no subscription — use "Create Subscription" in the Membership section above'
                                  : 'Add a card in the Payments tab, then use "Create Subscription"'
                                : 'Link a Stripe customer first via the Edit dialog'}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">No membership — create one first</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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

                <Separator />

                {/* Send SMS Section */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Send SMS
                  </h4>
                  {selectedMember.phoneNumber ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Send a direct text to {selectedMember.firstName} ({selectedMember.phoneNumber})</p>
                      <Textarea
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        placeholder="Type your message…"
                        rows={3}
                        maxLength={1600}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{smsMessage.length}/1600</span>
                        <Button
                          size="sm"
                          onClick={() => sendSmsMutation.mutate({ userId: selectedMember.id, message: smsMessage })}
                          disabled={!smsMessage.trim() || sendSmsMutation.isPending}
                        >
                          {sendSmsMutation.isPending ? "Sending…" : "Send SMS"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
                      No phone number on file. Ask the member to add their phone number to enable SMS.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4" data-testid="tab-content-payments">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Payment Methods</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddPaymentMethod}
                      disabled={addingPaymentMethod}
                      data-testid="button-add-payment-method"
                    >
                      {addingPaymentMethod ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Card
                    </Button>
                  </div>
                  {isLoadingPaymentMethods ? (
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Loading payment methods...</p>
                    </div>
                  ) : memberPaymentMethods && memberPaymentMethods.length > 0 ? (
                    <div className="space-y-2">
                      {memberPaymentMethods.map((pm) => (
                        <div key={pm.id} className="border rounded-lg p-3 hover:bg-gray-50 flex justify-between items-center" data-testid={`payment-method-${pm.id}`}>
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {pm.cardBrand} •••• {pm.cardLast4}
                                {pm.isDefault && (
                                  <Badge className="ml-2 text-xs bg-green-100 text-green-800">Default</Badge>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                Expires {pm.cardExpMonth}/{pm.cardExpYear}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <CreditCard className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No payment methods on file</p>
                      <p className="text-xs text-gray-500 mt-1">Add a card to enable subscription creation</p>
                    </div>
                  )}
                </div>

                <Separator />

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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

              <Separator />

              {/* Link Stripe Customer Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  Link Stripe Customer
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Connect this member to a Stripe customer account to enable subscription sync. Linking takes effect immediately — no need to save.
                  {selectedMember?.stripeCustomerId && (
                    <span className="block mt-1 font-medium text-green-700">
                      Currently linked: <span className="font-mono">{selectedMember.stripeCustomerId}</span>
                    </span>
                  )}
                </p>

                {/* Mode toggle */}
                <div className="flex gap-1 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={linkStripeMode === "id" ? "default" : "outline"}
                    className="text-xs h-7 px-3"
                    onClick={() => { setLinkStripeMode("id"); setLinkStripeStatus(null); setLinkStripeSearchResults([]); }}
                  >
                    Paste Customer ID
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={linkStripeMode === "email" ? "default" : "outline"}
                    className="text-xs h-7 px-3"
                    onClick={() => { setLinkStripeMode("email"); setLinkStripeStatus(null); setLinkStripeInput(""); }}
                  >
                    Search by Email
                  </Button>
                </div>

                {linkStripeMode === "id" ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="cus_xxxxxxxxxxxxxxxx"
                      value={linkStripeInput}
                      onChange={(e) => {
                        setLinkStripeInput(e.target.value);
                        setLinkStripeStatus(null);
                      }}
                      className="font-mono text-sm"
                      data-testid="input-link-stripe-customer"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!linkStripeInput.trim() || linkStripeCustomerMutation.isPending}
                      onClick={() => {
                        if (selectedMember) {
                          linkStripeCustomerMutation.mutate({
                            memberId: selectedMember.id,
                            stripeCustomerId: linkStripeInput.trim(),
                          });
                        }
                      }}
                      data-testid="button-link-stripe-customer"
                    >
                      {linkStripeCustomerMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      <span className="ml-1">Link</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Search Stripe by email address..."
                        value={linkStripeEmailSearch}
                        onChange={(e) => {
                          setLinkStripeEmailSearch(e.target.value);
                          setLinkStripeSearchResults([]);
                          setLinkStripeStatus(null);
                        }}
                        data-testid="input-link-stripe-email-search"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={linkStripeEmailSearch.trim().length < 3 || linkStripeSearching}
                        onClick={async () => {
                          setLinkStripeSearching(true);
                          setLinkStripeSearchResults([]);
                          setLinkStripeStatus(null);
                          try {
                            const res = await fetch(`/api/admin/stripe/customers/search?email=${encodeURIComponent(linkStripeEmailSearch.trim())}`);
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.message);
                            setLinkStripeSearchResults(data.results || []);
                            if ((data.results || []).length === 0) {
                              setLinkStripeStatus({ type: "error", message: "No Stripe customers found with that email." });
                            }
                          } catch (err: any) {
                            setLinkStripeStatus({ type: "error", message: err.message || "Search failed" });
                          } finally {
                            setLinkStripeSearching(false);
                          }
                        }}
                        data-testid="button-link-stripe-email-search"
                      >
                        {linkStripeSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-1">Search</span>
                      </Button>
                    </div>
                    {linkStripeSearchResults.length > 0 && (
                      <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                        {linkStripeSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setLinkStripeInput(customer.id);
                              setLinkStripeMode("id");
                              setLinkStripeSearchResults([]);
                              setLinkStripeStatus(null);
                            }}
                          >
                            <span className="flex flex-col">
                              <span className="font-medium">{customer.email}</span>
                              {customer.name && <span className="text-gray-500">{customer.name}</span>}
                            </span>
                            <span className="font-mono text-gray-400 ml-2">{customer.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {linkStripeStatus && (
                  <div
                    className={`mt-2 text-xs flex items-start gap-1.5 rounded-md px-3 py-2 ${
                      linkStripeStatus.type === "success"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {linkStripeStatus.type === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      {linkStripeStatus.message}
                      {linkStripeStatus.emailMismatch && linkStripeStatus.stripeCustomerId && (
                        <div className="mt-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-6 text-xs px-2"
                            disabled={linkStripeCustomerMutation.isPending}
                            onClick={() => {
                              if (selectedMember && linkStripeStatus.stripeCustomerId) {
                                linkStripeCustomerMutation.mutate({
                                  memberId: selectedMember.id,
                                  stripeCustomerId: linkStripeStatus.stripeCustomerId,
                                  force: true,
                                });
                              }
                            }}
                          >
                            Link anyway (override email mismatch)
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

      {/* Cancel Membership Friction Dialog */}
      <Dialog open={isCancelMembershipOpen} onOpenChange={(open) => {
        setIsCancelMembershipOpen(open);
        if (!open) {
          setCancelImmediately(false);
          setCancelReason("");
        }
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-cancel-membership">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancel Membership
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  <p className="font-semibold mb-2">You are about to cancel the membership for:</p>
                  <p className="text-lg font-bold">{selectedMember?.firstName} {selectedMember?.lastName}</p>
                  <p className="text-sm text-red-600">{selectedMember?.email}</p>
                </div>

                {selectedMember?.membership && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                    <p className="font-semibold mb-2">This member will lose:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Access to all wellness center facilities</li>
                      <li>Remaining time until {selectedMember.membership.endDate ? format(new Date(selectedMember.membership.endDate + 'T12:00:00'), 'MMMM d, yyyy') : 'end date'}</li>
                      <li>Auto-renewal of their {selectedMember.membership.planType} plan</li>
                      {selectedMember.membership.stripeSubscriptionId && (
                        <li>Their Stripe subscription will be cancelled</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="cancel-immediately"
                      checked={cancelImmediately}
                      onCheckedChange={(checked) => setCancelImmediately(checked === true)}
                      data-testid="checkbox-cancel-immediately"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="cancel-immediately" className="font-medium text-red-700 cursor-pointer">
                        Cancel immediately (end access now)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        If unchecked, membership remains active until the end of the current billing period
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cancel-reason">Reason for cancellation (optional)</Label>
                    <Textarea
                      id="cancel-reason"
                      placeholder="e.g., Member requested cancellation, Non-payment, etc."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                      data-testid="input-cancel-reason"
                    />
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsCancelMembershipOpen(false)}
              data-testid="button-cancel-cancel"
            >
              Keep Membership
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmCancelMembership}
              disabled={cancelMembershipMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMembershipMutation.isPending ? "Cancelling..." : "Cancel Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={(open) => {
        setIsResetPasswordOpen(open);
        if (!open) setNewPassword("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetPasswordOpen(false);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember && newPassword.length >= 6) {
                  resetPasswordMutation.mutate({
                    userId: selectedMember.id,
                    password: newPassword,
                  });
                } else if (newPassword.length < 6) {
                  toast({
                    title: "Password too short",
                    description: "Password must be at least 6 characters",
                    variant: "destructive",
                  });
                }
              }}
              disabled={resetPasswordMutation.isPending || newPassword.length < 6}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog open={isAddPaymentMethodOpen} onOpenChange={(open) => {
        if (!open) {
          handlePaymentMethodCancel();
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-payment-method">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Add Payment Method
            </DialogTitle>
            <DialogDescription>
              Add a credit or debit card for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          {paymentMethodClientSecret && selectedMember && (
            <AdminAddPaymentMethod
              clientSecret={paymentMethodClientSecret}
              memberId={selectedMember.id}
              onSuccess={handlePaymentMethodSuccess}
              onCancel={handlePaymentMethodCancel}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Membership Dialog */}
      <Dialog open={isCreateMembershipOpen} onOpenChange={setIsCreateMembershipOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-membership">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Membership
            </DialogTitle>
            <DialogDescription>
              Create a new membership for {selectedMember?.firstName} {selectedMember?.lastName}. 
              This will also set up recurring billing using their saved payment method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-type">Membership Plan</Label>
              <Select value={selectedPlanType} onValueChange={setSelectedPlanType}>
                <SelectTrigger id="plan-type" data-testid="select-plan-type">
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {membershipPlans
                    .filter(plan => plan.isActive && plan.planType !== 'daily')
                    .map(plan => (
                      <SelectItem key={plan.id} value={plan.planType}>
                        {plan.name} - ${plan.monthlyPrice}/month
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPlanType && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-blue-800">What will happen:</p>
                <ul className="list-disc list-inside text-blue-700 mt-1 space-y-1">
                  <li>Membership starts today for 30 days</li>
                  <li>Card charged immediately for first month</li>
                  <li>Subscription set up for monthly recurring billing</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateMembershipOpen(false)}
              data-testid="button-cancel-create-membership"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember && selectedPlanType) {
                  createMembershipMutation.mutate({
                    userId: selectedMember.id,
                    planType: selectedPlanType,
                  });
                }
              }}
              disabled={!selectedPlanType || createMembershipMutation.isPending}
              data-testid="button-confirm-create-membership"
            >
              {createMembershipMutation.isPending ? "Creating..." : "Create Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stripe Sync Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Memberships with Stripe</DialogTitle>
            <DialogDescription>
              Reconciles membership statuses against live Stripe data and links any new subscriptions created directly in Stripe that aren't reflected in the app yet.
            </DialogDescription>
          </DialogHeader>

          {!syncResults ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                This runs two passes: first it corrects status mismatches for memberships already linked to a subscription, then it scans each member's Stripe customer for any active subscriptions not yet linked to the app.
              </p>
              <Button
                onClick={() => syncStripeMutation.mutate()}
                disabled={syncStripeMutation.isPending}
                className="w-full"
              >
                {syncStripeMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Run Sync Now
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{syncResults.checked}</p>
                  <p className="text-xs text-muted-foreground">Checked</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{syncResults.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${syncResults.newlyLinked > 0 ? 'bg-purple-50 dark:bg-purple-950/30' : 'bg-muted'}`}>
                  <p className={`text-2xl font-bold ${syncResults.newlyLinked > 0 ? 'text-purple-600' : ''}`}>{syncResults.newlyLinked ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Linked</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${syncResults.errors > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-green-50 dark:bg-green-950/30'}`}>
                  <p className={`text-2xl font-bold ${syncResults.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>{syncResults.errors}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>

              {syncResults.newlyLinkedDetails.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-400">New subscriptions linked from Stripe:</p>
                  {syncResults.newlyLinkedDetails.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                      <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium truncate block">{r.email}</span>
                        <span className="text-muted-foreground">Linked {r.subscriptionId} → {r.newStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {syncResults.results.filter(r => r.action !== 'ok').length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-sm font-medium">Status corrections:</p>
                  {syncResults.results.filter(r => r.action !== 'ok').map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium truncate block">{r.email}</span>
                        <span className="text-muted-foreground">{r.oldStatus} → {r.newStatus} ({r.action})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {syncResults.errors === 0 && syncResults.updated === 0 && (syncResults.newlyLinked ?? 0) === 0 && (
                <p className="text-sm text-center text-green-600 font-medium">All memberships are in sync with Stripe.</p>
              )}

              {syncResults.errorDetails.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-destructive">Errors:</p>
                  {syncResults.errorDetails.map((e, i) => (
                    <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-950/20 rounded">
                      <span className="font-medium">{e.email}:</span> {e.error}
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => { setSyncResults(null); }}>
                Run Again
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Guest Dialog */}
      <Dialog open={isViewGuestOpen} onOpenChange={(open) => { setIsViewGuestOpen(open); if (!open) setSelectedGuest(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guest Visit History</DialogTitle>
            <DialogDescription>
              Viewing waiver history for {selectedGuest?.firstName} {selectedGuest?.lastName}
            </DialogDescription>
          </DialogHeader>

          {selectedGuest && (
            <div className="space-y-4">
              {/* Guest info */}
              <div className="grid grid-cols-2 gap-4 bg-purple-50 p-4 rounded-lg">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Name</h4>
                  <p className="text-sm font-medium">{selectedGuest.firstName} {selectedGuest.lastName}</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Email</h4>
                  <p className="text-sm">{selectedGuest.email}</p>
                </div>
                {selectedGuest.phoneNumber && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Phone</h4>
                    <p className="text-sm">{selectedGuest.phoneNumber}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Total Visits</h4>
                  <Badge className="bg-purple-100 text-purple-700">{selectedGuest.visitCount} {selectedGuest.visitCount === 1 ? "visit" : "visits"}</Badge>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Waiver History</h4>
                {isLoadingGuestWaivers ? (
                  <div className="text-center py-6">
                    <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading history...</p>
                  </div>
                ) : guestWaivers && guestWaivers.length > 0 ? (
                  <div className="space-y-2">
                    {guestWaivers.map((waiver) => (
                      <div key={waiver.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium">
                              {format(new Date(waiver.checkInTimestamp), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          {waiver.notes && (
                            <p className="text-xs text-gray-500 ml-6">{waiver.notes}</p>
                          )}
                        </div>
                        <Badge className="bg-green-100 text-green-700 text-xs">Signed</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No waiver records found.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewGuestOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
