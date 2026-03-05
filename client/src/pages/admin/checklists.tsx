import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sunrise,
  Sunset,
  Clock,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleDashed,
  PlayCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ChecklistType = "opening" | "closing" | "hourly";

interface ChecklistItem {
  id: number;
  type: string;
  category: string | null;
  text: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

interface ChecklistRun {
  id: number;
  type: string;
  date: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface ChecklistRunItem {
  id: number;
  runId: number;
  itemId: number;
  completedAt: string;
}

const TYPE_CONFIG: Record<ChecklistType, { label: string; icon: any; color: string }> = {
  opening: { label: "Opening", icon: Sunrise, color: "text-amber-500" },
  closing: { label: "Closing", icon: Sunset, color: "text-indigo-500" },
  hourly:  { label: "Hourly",  icon: Clock,   color: "text-emerald-500" },
};

const today = new Date().toISOString().split("T")[0];

function groupByCategory(items: ChecklistItem[]) {
  const groups: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    const cat = item.category ?? "General";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

// ─── Single Checklist Panel ────────────────────────────────────────────────
function ChecklistPanel({ type }: { type: ChecklistType }) {
  const { toast } = useToast();
  const [configMode, setConfigMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [addForm, setAddForm] = useState<{
    text: string;
    category: string;
    isRequired: boolean;
    sortOrder: number;
  } | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;

  // Fetch items
  const { data: items = [] } = useQuery<ChecklistItem[]>({
    queryKey: ["/api/admin/checklist-items", type],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/checklist-items?type=${type}`);
      return res.json();
    },
  });

  // Fetch today's run
  const { data: runs = [], refetch: refetchRuns } = useQuery<ChecklistRun[]>({
    queryKey: ["/api/admin/checklist-runs", type, today],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/checklist-runs?type=${type}&date=${today}`);
      return res.json();
    },
  });

  const run = runs[0] ?? null;

  // Fetch checked items for this run
  const { data: runItems = [], refetch: refetchRunItems } = useQuery<ChecklistRunItem[]>({
    queryKey: ["/api/admin/checklist-run-items", run?.id],
    queryFn: async () => {
      if (!run) return [];
      const res = await apiRequest("GET", `/api/admin/checklist-runs/${run.id}/items`);
      return res.json();
    },
    enabled: !!run,
  });

  const checkedIds = new Set(runItems.map((ri) => ri.itemId));
  const total = items.length;
  const completed = runItems.length;
  const requiredItems = items.filter((i) => i.isRequired);
  const requiredDone = requiredItems.filter((i) => checkedIds.has(i.id)).length;
  const allRequiredDone = requiredDone === requiredItems.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Mutations
  const startRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/checklist-runs", { type, date: today });
      return res.json();
    },
    onSuccess: () => {
      refetchRuns();
      toast({ title: `${cfg.label} checklist started` });
    },
  });

  const completeRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/admin/checklist-runs/${run!.id}`, {
        completedAt: new Date().toISOString(),
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchRuns();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-summary"] });
      toast({ title: `${cfg.label} checklist marked complete!` });
    },
  });

  const checkItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("POST", `/api/admin/checklist-runs/${run!.id}/items/${itemId}`, {});
    },
    onSuccess: () => {
      refetchRunItems();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-summary"] });
    },
  });

  const uncheckItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/admin/checklist-runs/${run!.id}/items/${itemId}`);
    },
    onSuccess: () => {
      refetchRunItems();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-summary"] });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      await apiRequest("POST", "/api/admin/checklist-items", { ...data, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-items", type] });
      setAddForm(null);
      toast({ title: "Item added" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      await apiRequest("PUT", `/api/admin/checklist-items/${item.id}`, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-items", type] });
      setEditingItem(null);
      toast({ title: "Item updated" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/checklist-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checklist-items", type] });
      setDeleteConfirmId(null);
      toast({ title: "Item removed" });
    },
  });

  const toggleCategory = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleCheck = (itemId: number, checked: boolean) => {
    if (!run) return;
    if (checked) checkItemMutation.mutate(itemId);
    else uncheckItemMutation.mutate(itemId);
  };

  // ── Run Mode ──────────────────────────────────────────────────────────────
  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-muted ${cfg.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{cfg.label} Checklist</h3>
            <p className="text-sm text-muted-foreground">{format(new Date(today + "T12:00:00"), "EEEE, MMMM d, yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run?.completedAt && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
          {run && !run.completedAt && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              <PlayCircle className="h-3 w-3 mr-1" />
              In Progress
            </Badge>
          )}
          {!run && (
            <Badge variant="outline" className="text-muted-foreground">
              <CircleDashed className="h-3 w-3 mr-1" />
              Not Started
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigMode((v) => !v)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            {configMode ? "Run Mode" : "Configure"}
          </Button>
        </div>
      </div>

      {/* ── Configure Mode ───────────────────────────────────────────────── */}
      {configMode ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No items yet. Add one below.</p>
              )}
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                  {editingItem?.id === item.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editingItem.text}
                        onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                        placeholder="Task description"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editingItem.category ?? ""}
                          onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                          placeholder="Category (e.g. Safety)"
                        />
                        <Input
                          type="number"
                          value={editingItem.sortOrder}
                          onChange={(e) => setEditingItem({ ...editingItem, sortOrder: Number(e.target.value) })}
                          placeholder="Sort order"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={editingItem.isRequired}
                          onCheckedChange={(v) => setEditingItem({ ...editingItem, isRequired: !!v })}
                          id={`edit-req-${item.id}`}
                        />
                        <Label htmlFor={`edit-req-${item.id}`} className="text-sm">Required</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateItemMutation.mutate(editingItem)} disabled={updateItemMutation.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.category && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.category}</span>}
                          {item.isRequired && <span className="text-xs text-red-600 font-medium">Required</span>}
                          <span className="text-xs text-muted-foreground">#{item.sortOrder}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add new item form */}
              {addForm ? (
                <div className="border rounded-lg p-3 space-y-2 bg-background">
                  <Input
                    value={addForm.text}
                    onChange={(e) => setAddForm({ ...addForm, text: e.target.value })}
                    placeholder="Task description *"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                      placeholder="Category (e.g. Safety)"
                    />
                    <Input
                      type="number"
                      value={addForm.sortOrder}
                      onChange={(e) => setAddForm({ ...addForm, sortOrder: Number(e.target.value) })}
                      placeholder="Sort order"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={addForm.isRequired}
                      onCheckedChange={(v) => setAddForm({ ...addForm, isRequired: !!v })}
                      id="add-required"
                    />
                    <Label htmlFor="add-required" className="text-sm">Required</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => createItemMutation.mutate(addForm)}
                      disabled={!addForm.text.trim() || createItemMutation.isPending}
                    >
                      Add Item
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddForm(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddForm({ text: "", category: "", isRequired: false, sortOrder: items.length + 1 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Delete confirmation dialog */}
          <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove checklist item?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">This item will be removed from the checklist. This cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirmId && deleteItemMutation.mutate(deleteConfirmId)}
                  disabled={deleteItemMutation.isPending}
                >
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        /* ── Run Mode ──────────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Progress */}
          {run && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{completed} of {total} items completed</span>
                <span className="font-medium">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              {requiredItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {requiredDone}/{requiredItems.length} required items done
                  {!allRequiredDone && <span className="text-amber-600 ml-1">— complete required items to finish</span>}
                </p>
              )}
            </div>
          )}

          {/* Not started */}
          {!run && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center space-y-3">
                <CircleDashed className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No {cfg.label.toLowerCase()} checklist started today.</p>
                <Button onClick={() => startRunMutation.mutate()} disabled={startRunMutation.isPending}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start {cfg.label} Checklist
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Items grouped by category */}
          {run && (
            <div className="space-y-3">
              {Object.entries(groups).map(([cat, catItems]) => {
                const collapsed = collapsedCats.has(cat);
                const catDone = catItems.filter((i) => checkedIds.has(i.id)).length;
                return (
                  <Card key={cat}>
                    <CardHeader
                      className="pb-2 pt-3 px-4 cursor-pointer select-none"
                      onClick={() => toggleCategory(cat)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium text-sm">{cat}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{catDone}/{catItems.length}</span>
                      </div>
                    </CardHeader>
                    {!collapsed && (
                      <CardContent className="pt-0 px-4 pb-3 space-y-2">
                        {catItems.map((item) => {
                          const checked = checkedIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
                                checked ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => handleCheck(item.id, !!v)}
                                disabled={!!run.completedAt}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>
                                  {item.text}
                                </span>
                                {item.isRequired && !checked && (
                                  <span className="ml-2 text-xs text-red-500">*required</span>
                                )}
                              </div>
                              {checked && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Complete / Already completed */}
          {run && !run.completedAt && (
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label htmlFor="notes">Shift notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any notes, incidents, or follow-up items..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
                {!allRequiredDone && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Complete all required items before marking as done.
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => completeRunMutation.mutate()}
                  disabled={!allRequiredDone || completeRunMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Checklist Complete
                </Button>
              </CardContent>
            </Card>
          )}

          {run?.completedAt && (
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <CardContent className="py-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Checklist completed</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Finished at {format(new Date(run.completedAt), "h:mm a")}
                    {run.notes && ` · "${run.notes}"`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function AdminChecklists({ defaultTab }: { defaultTab?: ChecklistType }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Shift Checklists</h2>
        <p className="text-muted-foreground">Run through daily operational checklists. Configure items with the Configure button on each tab.</p>
      </div>

      <Tabs defaultValue={defaultTab ?? "opening"} className="space-y-4">
        <TabsList>
          {(["opening", "closing", "hourly"] as const).map((type) => {
            const { label, icon: Icon, color } = TYPE_CONFIG[type];
            return (
              <TabsTrigger key={type} value={type} className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {(["opening", "closing", "hourly"] as const).map((type) => (
          <TabsContent key={type} value={type}>
            <ChecklistPanel type={type} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
