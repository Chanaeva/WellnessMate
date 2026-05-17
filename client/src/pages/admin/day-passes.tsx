import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PunchCard, User, DayPassHours } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Clock, Users, Ticket, Search, RefreshCw, Calendar, AlertCircle, PlusCircle, MinusCircle } from "lucide-react";
import { format } from "date-fns";

type PunchCardWithUser = PunchCard & { user?: User };

export default function AdminDayPasses() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [hoursForm, setHoursForm] = useState<Partial<DayPassHours>>({
    startTime: "",
    endTime: ""
  });
  const [addDaysDialog, setAddDaysDialog] = useState<{ open: boolean; card: PunchCardWithUser | null }>({
    open: false,
    card: null
  });
  const [daysToAdd, setDaysToAdd] = useState(1);
  const [deductDialog, setDeductDialog] = useState<{ open: boolean; card: PunchCardWithUser | null }>({
    open: false,
    card: null
  });

  const { data: activePunchCards = [], isLoading: cardsLoading, refetch: refetchCards } = useQuery<PunchCardWithUser[]>({
    queryKey: ["/api/admin/active-punch-cards"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/active-punch-cards");
      return res.json();
    },
  });

  const { data: dayPassHours, isLoading: hoursLoading } = useQuery<DayPassHours>({
    queryKey: ["/api/day-pass-hours"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/day-pass-hours");
      const data = await res.json();
      if (data) {
        setHoursForm({ startTime: data.startTime || "", endTime: data.endTime || "" });
      }
      return data;
    },
  });

  const { data: todayCheckIns = [] } = useQuery<any[]>({
    queryKey: ["/api/check-ins/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/check-ins/today");
      return res.json();
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: async (data: Partial<DayPassHours>) => {
      const res = await apiRequest("PUT", "/api/admin/day-pass-hours", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/day-pass-hours"] });
      toast({ title: "Success", description: "Day pass hours updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const dayPassCheckIns = todayCheckIns.filter((c: any) => c.checkInType === 'day_pass');
  
  const filteredCards = activePunchCards.filter(card => {
    if (!searchTerm) return true;
    const user = card.user;
    const searchLower = searchTerm.toLowerCase();
    return (
      user?.firstName?.toLowerCase().includes(searchLower) ||
      user?.lastName?.toLowerCase().includes(searchLower) ||
      user?.email?.toLowerCase().includes(searchLower)
    );
  });

  const addPunchesMutation = useMutation({
    mutationFn: async ({ cardId, punchesToAdd }: { cardId: number; punchesToAdd: number }) => {
      const res = await apiRequest("POST", `/api/admin/punch-cards/${cardId}/add-punches`, { punchesToAdd });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-punch-cards"] });
      toast({ title: "Success", description: `Added ${daysToAdd} day(s) to the day pass` });
      setAddDaysDialog({ open: false, card: null });
      setDaysToAdd(1);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deductPunchMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/admin/manual-punch-deduction", { userId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-punch-cards"] });
      toast({
        title: "Punch Deducted",
        description: `1 punch deducted. ${data.remainingPunches} remaining.`,
      });
      setDeductDialog({ open: false, card: null });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateHours = () => {
    if (!hoursForm.startTime || !hoursForm.endTime) {
      toast({ title: "Error", description: "Please enter both start and end times", variant: "destructive" });
      return;
    }
    updateHoursMutation.mutate(hoursForm);
  };

  const handleAddDays = () => {
    if (!addDaysDialog.card) return;
    addPunchesMutation.mutate({ cardId: addDaysDialog.card.id, punchesToAdd: daysToAdd });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Day Pass Management</h2>
          <p className="text-muted-foreground">Manage day pass holders and settings</p>
        </div>
        <Button variant="outline" onClick={() => refetchCards()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Day Passes</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePunchCards.length}</div>
            <p className="text-xs text-muted-foreground">Users with remaining punches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Day Pass Check-ins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dayPassCheckIns.length}</div>
            <p className="text-xs text-muted-foreground">Day pass users checked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day Pass Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dayPassHours?.startTime || "--"} - {dayPassHours?.endTime || "--"}
            </div>
            <p className="text-xs text-muted-foreground">When day pass users can check in</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holders">Day Pass Holders</TabsTrigger>
          <TabsTrigger value="settings">Hours Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="holders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Day Pass Holders</CardTitle>
              <CardDescription>Users with punch cards that have remaining visits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {cardsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredCards.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "No day pass holders found matching your search" : "No active day pass holders"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead className="text-center">Remaining</TableHead>
                        <TableHead className="text-center">Used</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCards.map((card) => (
                        <TableRow key={card.id}>
                          <TableCell className="font-medium">
                            {card.user?.firstName} {card.user?.lastName}
                          </TableCell>
                          <TableCell>{card.user?.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{card.name || "Day Pass"}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={card.remainingPunches > 0 ? "default" : "secondary"}>
                              {card.remainingPunches}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {card.totalPunches - card.remainingPunches}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {card.purchasedAt ? format(new Date(card.purchasedAt), "MMM d, yyyy") : "--"}
                          </TableCell>
                          <TableCell>
                            {card.expiresAt ? (
                              <span className={new Date(card.expiresAt) < new Date() ? "text-destructive" : ""}>
                                {format(new Date(card.expiresAt), "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAddDaysDialog({ open: true, card });
                                  setDaysToAdd(1);
                                }}
                              >
                                <PlusCircle className="h-4 w-4 mr-1" />
                                Add Days
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                disabled={card.remainingPunches <= 0}
                                onClick={() => setDeductDialog({ open: true, card })}
                              >
                                <MinusCircle className="h-4 w-4 mr-1" />
                                Deduct
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

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Day Pass Check-in Hours</CardTitle>
              <CardDescription>
                Set the hours during which day pass users can check in. Members can check in anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    placeholder="e.g., 10:00 AM"
                    value={hoursForm.startTime || ""}
                    onChange={(e) => setHoursForm({ ...hoursForm, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    placeholder="e.g., 6:00 PM"
                    value={hoursForm.endTime || ""}
                    onChange={(e) => setHoursForm({ ...hoursForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <Button 
                onClick={handleUpdateHours} 
                disabled={updateHoursMutation.isPending}
              >
                {updateHoursMutation.isPending ? "Saving..." : "Save Hours"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deductDialog.open} onOpenChange={(open) => setDeductDialog({ open, card: open ? deductDialog.card : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deduct a Punch</DialogTitle>
            <DialogDescription>
              This will remove 1 punch from{" "}
              <strong>{deductDialog.card?.user?.firstName} {deductDialog.card?.user?.lastName}</strong>'s
              day pass. They currently have{" "}
              <strong>{deductDialog.card?.remainingPunches}</strong> punch{deductDialog.card?.remainingPunches !== 1 ? "es" : ""} remaining.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductDialog({ open: false, card: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deductDialog.card?.user?.id) {
                  deductPunchMutation.mutate(deductDialog.card.user.id);
                }
              }}
              disabled={deductPunchMutation.isPending}
            >
              {deductPunchMutation.isPending ? "Deducting..." : "Deduct 1 Punch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDaysDialog.open} onOpenChange={(open) => setAddDaysDialog({ open, card: open ? addDaysDialog.card : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Days to Day Pass</DialogTitle>
            <DialogDescription>
              Add additional days to {addDaysDialog.card?.user?.firstName} {addDaysDialog.card?.user?.lastName}'s day pass.
              Current remaining: {addDaysDialog.card?.remainingPunches} days
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="daysToAdd">Days to Add</Label>
            <Input
              id="daysToAdd"
              type="number"
              min={1}
              max={100}
              value={daysToAdd}
              onChange={(e) => setDaysToAdd(Math.max(1, parseInt(e.target.value) || 1))}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDaysDialog({ open: false, card: null })}>
              Cancel
            </Button>
            <Button onClick={handleAddDays} disabled={addPunchesMutation.isPending}>
              {addPunchesMutation.isPending ? "Adding..." : `Add ${daysToAdd} Day${daysToAdd > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
