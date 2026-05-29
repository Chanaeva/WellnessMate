import { useState, useRef, useCallback } from "react";
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
import {
  Mail,
  Plus,
  Trash2,
  Send,
  Edit,
  Clock,
  Users,
  CheckCircle2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Minus,
} from "lucide-react";
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
  plainBody: string;
  recipientFilter: "all" | "active_members" | "day_pass_holders";
};

const EMPTY_FORM: FormState = {
  subject: "",
  plainBody: "",
  recipientFilter: "all",
};

// ── Rich Text Editor ──────────────────────────────────────────────────────────

type ToolbarButtonProps = {
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
};

function ToolbarButton({ onMouseDown, title, children, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className={`p-1.5 rounded hover:bg-accent transition-colors ${active ? "bg-accent" : ""}`}
    >
      {children}
    </button>
  );
}

type RichEditorProps = {
  initialHtml: string;
  onChange: (html: string) => void;
};

function RichEditor({ initialHtml, onChange }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  }, [onChange]);

  const handleLink = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const url = window.prompt("Enter URL:", "https://");
    if (url) exec("createLink", url);
  }, [exec]);

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40">
        <ToolbarButton title="Bold" onMouseDown={(e) => { preventBlur(e); exec("bold"); }}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onMouseDown={(e) => { preventBlur(e); exec("italic"); }}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Bulleted list" onMouseDown={(e) => { preventBlur(e); exec("insertUnorderedList"); }}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onMouseDown={(e) => { preventBlur(e); exec("insertOrderedList"); }}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Insert link" onMouseDown={handleLink}>
          <Link className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Horizontal rule" onMouseDown={(e) => { preventBlur(e); exec("insertHorizontalRule"); }}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <select
          className="text-xs border rounded px-1 py-0.5 bg-background"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) {
              exec("formatBlock", e.target.value);
              e.target.value = "";
            }
          }}
          title="Heading"
        >
          <option value="" disabled>Heading</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="p">Paragraph</option>
        </select>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        className="min-h-[200px] p-3 text-sm focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold"
        style={{ minHeight: 200 }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminNewsletter() {
  const { toast } = useToast();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // htmlBody is tracked separately so the rich editor controls it
  const [htmlBody, setHtmlBody] = useState("");
  // key used to remount RichEditor when opening a different draft
  const [editorKey, setEditorKey] = useState(0);

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
    mutationFn: async (data: FormState & { htmlBody: string }) => {
      const res = await apiRequest("POST", "/api/admin/newsletters", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      closeComposer();
      toast({ title: "Draft saved", description: "Newsletter draft has been created." });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to save draft.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState & { htmlBody: string } }) => {
      const res = await apiRequest("PATCH", `/api/admin/newsletters/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletters"] });
      closeComposer();
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

  function closeComposer() {
    setComposerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setHtmlBody("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setHtmlBody("");
    setEditorKey((k) => k + 1);
    setComposerOpen(true);
  }

  function openEdit(nl: Newsletter) {
    setEditingId(nl.id);
    setForm({
      subject: nl.subject,
      plainBody: nl.plainBody,
      recipientFilter: nl.recipientFilter,
    });
    setHtmlBody(nl.htmlBody);
    setEditorKey((k) => k + 1);
    setComposerOpen(true);
  }

  function handleSave() {
    const strippedHtml = htmlBody.replace(/<[^>]+>/g, "").trim();
    if (!form.subject.trim() || !strippedHtml || !form.plainBody.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in the subject, email body, and plain text version.",
        variant: "destructive",
      });
      return;
    }
    const payload = { ...form, htmlBody };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
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
            Compose and send email newsletters to your members. Each email includes a personalized greeting.
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
                    <Button size="sm" variant="outline" onClick={() => openEdit(nl)}>
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => setSendConfirmId(nl.id)}>
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
      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          if (!open) closeComposer();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {editingId !== null ? "Edit Newsletter Draft" : "New Newsletter"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                placeholder="e.g. Introducing our new summer sessions!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>

            {/* Recipient filter */}
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
                  Estimated recipients:{" "}
                  <span className="font-semibold">{recipientCount.count}</span>
                </p>
              )}
            </div>

            {/* Rich-text body */}
            <div className="space-y-2">
              <Label>Email Body</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Use the toolbar to format your message. A personalized greeting ("Hi [Name],") and
                branded header/footer are added automatically.
              </p>
              <RichEditor
                key={editorKey}
                initialHtml={htmlBody}
                onChange={setHtmlBody}
              />
            </div>

            {/* Plain text */}
            <div className="space-y-2">
              <Label htmlFor="plain-body">Plain Text Version</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Shown to email clients that don't support HTML (required). A personalized greeting
                is prepended automatically.
              </p>
              <Textarea
                id="plain-body"
                placeholder={"We're excited to share some news about Wolf Mother Wellness..."}
                value={form.plainBody}
                onChange={(e) => setForm({ ...form, plainBody: e.target.value })}
                className="min-h-[100px] text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={closeComposer}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : "Save Draft"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Confirm */}
      <AlertDialog
        open={sendConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setSendConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              {sendPreviewCount !== undefined ? (
                <>
                  This will send the newsletter to{" "}
                  <span className="font-semibold">
                    {sendPreviewCount.count} recipient
                    {sendPreviewCount.count !== 1 ? "s" : ""}
                  </span>
                  . This action cannot be undone.
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

      {/* Delete Confirm */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
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
              onClick={() =>
                deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)
              }
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
