import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Send, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SmsBroadcast = {
  id: number;
  message: string;
  sentBy: number;
  recipientCount: number;
  successCount: number;
  failCount: number;
  createdAt: string;
};

type RecipientPreview = {
  count: number;
  recipients: { id: number; phoneNumber: string; firstName: string; lastName: string }[];
};

export default function AdminSMS() {
  const { toast } = useToast();
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const { data: recipientData, isLoading: recipientsLoading } = useQuery<RecipientPreview>({
    queryKey: ["/api/admin/sms/recipients"],
    staleTime: 30 * 1000,
  });

  const { data: broadcasts = [], isLoading: broadcastsLoading } = useQuery<SmsBroadcast[]>({
    queryKey: ["/api/admin/sms/broadcasts"],
    staleTime: 30 * 1000,
  });

  const broadcastMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/admin/sms/broadcast", { message });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Queued",
        description: `Sending to ${data.recipientCount} member${data.recipientCount !== 1 ? "s" : ""}…`,
      });
      setBroadcastMessage("");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/sms/broadcasts"] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    broadcastMutation.mutate(broadcastMessage.trim());
  };

  const charCount = broadcastMessage.length;
  const msgCount = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">SMS Messaging</h1>
        <p className="text-muted-foreground">Broadcast text messages to opted-in members</p>
      </div>

      {/* Audience Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Opted-In Audience
          </CardTitle>
          <CardDescription>
            Members who have enabled SMS notifications and have a phone number on file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recipientsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-blue-600">{recipientData?.count ?? 0}</div>
              <div>
                <p className="text-sm font-medium">opted-in members</p>
                <p className="text-xs text-muted-foreground">with a phone number on file</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadcast Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-green-600" />
            Send Broadcast
          </CardTitle>
          <CardDescription>
            This message will be sent to all {recipientData?.count ?? 0} opted-in member{(recipientData?.count ?? 0) !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Type your message here…"
            rows={5}
            maxLength={1600}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {charCount}/1600 characters · {msgCount} SMS segment{msgCount !== 1 ? "s" : ""}
            </p>
            <Button
              onClick={handleBroadcast}
              disabled={!broadcastMessage.trim() || broadcastMutation.isPending || (recipientData?.count ?? 0) === 0}
            >
              {broadcastMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {recipientData?.count ?? 0} Member{(recipientData?.count ?? 0) !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
          {(recipientData?.count ?? 0) === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
              No opted-in members with phone numbers yet. Members can enable SMS in their account settings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" />
            Broadcast History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {broadcastsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          ) : broadcasts.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No broadcasts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div key={b.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap flex-1">{b.message}</p>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {b.createdAt ? format(new Date(b.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Users className="h-3 w-3" />
                      {b.recipientCount} recipient{b.recipientCount !== 1 ? "s" : ""}
                    </Badge>
                    {b.successCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1 border-green-300 text-green-700 bg-green-50">
                        <CheckCircle className="h-3 w-3" />
                        {b.successCount} delivered
                      </Badge>
                    )}
                    {b.failCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1 border-red-300 text-red-700 bg-red-50">
                        <XCircle className="h-3 w-3" />
                        {b.failCount} failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
