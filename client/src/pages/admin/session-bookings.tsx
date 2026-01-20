import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SessionBooking, SessionConfig, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Sun, 
  Moon, 
  Users, 
  Calendar, 
  Loader2, 
  XCircle,
  CheckCircle,
  CalendarCheck,
  User as UserIcon
} from "lucide-react";
import { format } from "date-fns";

type BookingWithUser = SessionBooking & { user?: User };

export default function AdminSessionBookings() {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: bookings = [], isLoading } = useQuery<BookingWithUser[]>({
    queryKey: ["/api/admin/session-bookings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/session-bookings?fromDate=${today}`);
      return res.json();
    },
  });

  const { data: sessions = [] } = useQuery<SessionConfig[]>({
    queryKey: ["/api/admin/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/sessions");
      return res.json();
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/session-bookings/${bookingId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session-bookings"] });
      toast({
        title: "Booking Cancelled",
        description: "The session booking has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  const todaysBookings = bookings.filter(b => b.bookingDate === today);
  const upcomingBookings = bookings.filter(b => b.bookingDate > today);

  const morningSession = sessions.find(s => s.sessionType === 'morning');
  const eveningSession = sessions.find(s => s.sessionType === 'evening');

  const todayMorningBookings = todaysBookings.filter(b => b.sessionType === 'morning');
  const todayEveningBookings = todaysBookings.filter(b => b.sessionType === 'evening');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Session Bookings</h1>
        <p className="text-muted-foreground">View and manage member session reservations</p>
      </div>

      {/* Today's Sessions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Sun className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Morning Session</CardTitle>
                  <CardDescription>
                    {morningSession ? `${morningSession.startTime} - ${morningSession.endTime}` : 'Not configured'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={morningSession?.isEnabled ? "default" : "secondary"}>
                {todayMorningBookings.length} / {morningSession?.capacity || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todayMorningBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No bookings for today's morning session</p>
            ) : (
              <div className="space-y-2">
                {todayMorningBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/50"
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {booking.user?.firstName} {booking.user?.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {booking.user?.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.status === 'checked_in' ? (
                        <Badge className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="secondary">Confirmed</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelBookingMutation.mutate(booking.id)}
                            disabled={cancelBookingMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                  <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Evening Session</CardTitle>
                  <CardDescription>
                    {eveningSession ? `${eveningSession.startTime} - ${eveningSession.endTime}` : 'Not configured'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={eveningSession?.isEnabled ? "default" : "secondary"}>
                {todayEveningBookings.length} / {eveningSession?.capacity || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {todayEveningBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No bookings for today's evening session</p>
            ) : (
              <div className="space-y-2">
                {todayEveningBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="flex items-center justify-between p-2 rounded bg-indigo-50 dark:bg-indigo-950/50"
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {booking.user?.firstName} {booking.user?.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {booking.user?.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.status === 'checked_in' ? (
                        <Badge className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="secondary">Confirmed</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelBookingMutation.mutate(booking.id)}
                            disabled={cancelBookingMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bookings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            <CardTitle>Upcoming Bookings</CardTitle>
          </div>
          <CardDescription>Session reservations for future dates</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No upcoming bookings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                upcomingBookings.reduce((acc, booking) => {
                  const date = booking.bookingDate;
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(booking);
                  return acc;
                }, {} as Record<string, BookingWithUser[]>)
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 7)
                .map(([date, dateBookings]) => (
                  <div key={date} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {format(new Date(date + 'T12:00:00'), "EEEE, MMMM d, yyyy")}
                      </span>
                      <Badge variant="outline">{dateBookings.length} booking{dateBookings.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {dateBookings.map((booking) => {
                        const Icon = booking.sessionType === 'morning' ? Sun : Moon;
                        const bgColor = booking.sessionType === 'morning' 
                          ? 'bg-amber-50 dark:bg-amber-950/50' 
                          : 'bg-indigo-50 dark:bg-indigo-950/50';
                        const iconColor = booking.sessionType === 'morning' ? 'text-amber-500' : 'text-indigo-500';
                        
                        return (
                          <div 
                            key={booking.id}
                            className={`flex items-center justify-between p-2 rounded ${bgColor}`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${iconColor}`} />
                              <span className="font-medium text-sm">
                                {booking.user?.firstName} {booking.user?.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize">
                                ({booking.sessionType})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelBookingMutation.mutate(booking.id)}
                              disabled={cancelBookingMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
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
