import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Plus, Trash2, Send, Edit, Clock, Users, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Newsletter = {
  id: number;
  subject: string;
  htmlBody: string;
  plainBody: string;
  recipientFilter: "all" | "active_members" | "day_pass_holders";
  status: "draft" | "sent";
  sentAt: string | null;
  sentCount: number;
  createdAt: string;
};

type FilterOption = {
  value: "all" | "active_members" | "day_pass_holders";
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Members" },
  { value: "active_members", label: "Active Subscribers Only" },
  { value: "day_pass_holders", label: "Day Pass Holders Only" },
];

const filterLabel = (v: string) =>
  FILTER_OPTIONS.find((f) => f.value === v)?.label ?? v;

type FormState = {
  subject: string;
  htmlBody: string;
  plainBody: string;
  recipientFilter: "all" | "active_members" | "day_pass_holders";
};

const EMPTY_FORM: FormState = {
  subject: "",
  htmlBody: "",
  plainBody: "",
  recipientFilter: "all",
};

export default function AdminNewsletter() {
  const { toast } = useToast();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [sendConfirmId, setSendConfirmId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: newsletters = [], isLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/admin/newsletters"],
  });

  const { data: recipientCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/newsletters/recipient-preview", form.recipientFilter],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/newsletters/recipient-preview?filter=${form.recipientFilter}`
      );
      return res.json();
    },
    enabled: composerOpen,
  });

  const { data: sendPreviewCount } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/newsletters", sendConfirmId, "recipients-count"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/newsletters/${sendConfirmId}/recipients-count`
      );
      return res.json();
    },
    enabled: sendConfirmId !== null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await apiRequest("POST", "/api/admin/newsletters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      setComposerOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Draft saved", description: "Newsletter draft has been created." });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      const res = await apiRequest("PATCH", `/api/admin/newsletters/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      setComposerOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      toast({ title: "Draft updated" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update draft.", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/newsletters/${id}/send`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      setSendConfirmId(null);
      toast({
        title: "Newsletter sent!",
        description: `Successfully sent to ${data.sent} of ${data.total} recipients.`,
      });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to send newsletter.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/newsletters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      setDeleteConfirmId(null);
      toast({ title: "Deleted", description: "Newsletter deleted." });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setComposerOpen(true);
  }

  function openEdit(nl: Newsletter) {
    setEditingId(nl.id);
    setForm({
      subject: nl.subject,
      htmlBody: nl.htmlBody,
      plainBody: nl.plainBody,
      recipientFilter: nl.recipientFilter,
    });
    setComposerOpen(true);
  }

  function handleSave() {
    if (!form.subject.trim() || !form.htmlBody.trim() || !form.plainBody.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in subject, HTML body, and plain text body.",
        variant: "destructive",
      });
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const drafts = newsletters.filter((n) => n.status === "draft");
  const sent = newsletters.filter((n) => n.status === "sent");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Newsletter</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compose and send email newsletters to your members.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Newsletter
        </Button>
      </div>

      {/* Drafts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Edit className="h-4 w-4" />
            Drafts
            {drafts.length > 0 && (
              <Badge variant="secondary">{drafts.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No drafts yet. Click "New Newsletter" to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {drafts.map((nl) => (
                <div
                  key={nl.id}
                  className="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{nl.subject}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {filterLabel(nl.recipientFilter)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(nl.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(nl)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSendConfirmId(nl.id)}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(nl.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sent History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Sent History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No newsletters sent yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sent.map((nl) => (
                <div
                  key={nl.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{nl.subject}</p>
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                        Sent
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {nl.sentCount} recipients &middot; {filterLabel(nl.recipientFilter)}
                      </span>
                      {nl.sentAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(nl.sentAt), "MMM d, yyyy h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirmId(nl.id)}
                    className="text-destructive hover:text-destructive shrink-0 ml-4"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Composer Dialog */}
      <Dialog open={composerOpen} onOpenChange={(open) => { setComposerOpen(open); if (!open) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {editingId !== null ? "Edit Newsletter Draft" : "New Newsletter"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                placeholder="e.g. Introducing our new summer sessions!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-filter">Send To</Label>
              <Select
                value={form.recipientFilter}
                onValueChange={(v) =>
                  setForm({ ...form, recipientFilter: v as FormState["recipientFilter"] })
                }
              >
                <SelectTrigger id="recipient-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recipientCount !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Estimated recipients: <span className="font-semibold">{recipientCount.count}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="html-body">
                Email Body (HTML)
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Write the main body of the email using HTML. A branded header and footer are added automatically.
              </p>
              <Textarea
                id="html-body"
                placeholder={`<p>Hi there,</p>\n<p>We're excited to share...</p>`}
                value={form.htmlBody}
                onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plain-body">Plain Text Version</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Used for email clients that don't support HTML (required).
              </p>
              <Textarea
                id="plain-body"
                placeholder="Hi there,&#10;&#10;We're excited to share..."
                value={form.plainBody}
                onChange={(e) => setForm({ ...form, plainBody: e.target.value })}
                className="min-h-[120px] text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => { setComposerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Confirm Dialog */}
      <AlertDialog open={sendConfirmId !== null} onOpenChange={(open) => { if (!open) setSendConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              {sendPreviewCount !== undefined ? (
                <>
                  This will send the newsletter to{" "}
                  <span className="font-semibold">{sendPreviewCount.count} recipient{sendPreviewCount.count !== 1 ? "s" : ""}</span>.
                  This action cannot be undone.
                </>
              ) : (
                "Loading recipient count..."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sendConfirmId !== null && sendMutation.mutate(sendConfirmId)}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? "Sending..." : "Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the newsletter. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
