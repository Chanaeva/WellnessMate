import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Plus, Edit, Trash2, Calendar, Clock, AlertCircle, Megaphone, Settings, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Notification, InsertNotification } from "@shared/schema";
import { format } from "date-fns";

type NotificationFormData = {
  title: string;
  message: string;
  type: 'announcement' | 'maintenance' | 'promotion' | 'alert';
  isActive: boolean;
  startDate: string;
  endDate: string;
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>({
    title: '',
    message: '',
    type: 'announcement',
    isActive: true,
    startDate: new Date().toISOString().slice(0, 16),
    endDate: ''
  });

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
  });

  // Create notification mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (data: InsertNotification) => {
      const res = await apiRequest("POST", "/api/admin/notifications", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/active"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Notification created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create notification",
        variant: "destructive",
      });
    },
  });

  // Update notification mutation
  const updateNotificationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Notification> }) => {
      const res = await apiRequest("PUT", `/api/admin/notifications/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/active"] });
      setIsEditDialogOpen(false);
      setSelectedNotification(null);
      resetForm();
      toast({
        title: "Success",
        description: "Notification updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification",
        variant: "destructive",
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/notifications/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/active"] });
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'announcement',
      isActive: true,
      startDate: new Date().toISOString().slice(0, 16),
      endDate: ''
    });
  };

  const handleEdit = (notification: Notification) => {
    setSelectedNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isActive: notification.isActive,
      startDate: notification.startDate ? new Date(notification.startDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      endDate: notification.endDate ? new Date(notification.endDate).toISOString().slice(0, 16) : ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = () => {
    const submissionData: InsertNotification = {
      title: formData.title,
      message: formData.message,
      type: formData.type,
      isActive: formData.isActive,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : null
    };

    if (selectedNotification) {
      updateNotificationMutation.mutate({ id: selectedNotification.id, data: submissionData });
    } else {
      createNotificationMutation.mutate(submissionData);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone className="h-4 w-4" />;
      case 'maintenance': return <Settings className="h-4 w-4" />;
      case 'promotion': return <Star className="h-4 w-4" />;
      case 'alert': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'promotion': return 'bg-green-100 text-green-800 border-green-200';
      case 'alert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isActive = (notification: Notification) => {
    if (!notification.isActive) return false;
    const now = new Date();
    const start = new Date(notification.startDate);
    const end = notification.endDate ? new Date(notification.endDate) : null;
    
    return now >= start && (!end || now <= end);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Manage member dashboard notifications</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="wellness-button-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Notification</DialogTitle>
              <DialogDescription>
                Create a notification that will appear on the member dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification title"
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Notification message"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createNotificationMutation.isPending}>
                {createNotificationMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Notification</DialogTitle>
            <DialogDescription>
              Update notification details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            <div>
              <Label htmlFor="edit-message">Message</Label>
              <Textarea
                id="edit-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Notification message"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-type">Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
            <div>
              <Label htmlFor="edit-startDate">Start Date</Label>
              <Input
                id="edit-startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-endDate">End Date (Optional)</Label>
              <Input
                id="edit-endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={updateNotificationMutation.isPending}>
              {updateNotificationMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            All Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading notifications...</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found. Create your first notification above.
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div key={notification.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${getTypeColor(notification.type)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{notification.title}</h3>
                          <Badge variant={isActive(notification) ? "default" : "secondary"}>
                            {isActive(notification) ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className={getTypeColor(notification.type)}>
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{notification.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Start: {format(new Date(notification.startDate), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                          {notification.endDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              End: {format(new Date(notification.endDate), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(notification)}
                      >
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
                            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this notification? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteNotificationMutation.mutate(notification.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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