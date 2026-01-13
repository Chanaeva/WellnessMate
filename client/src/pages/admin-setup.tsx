import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const adminSetupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminSetupForm = z.infer<typeof adminSetupSchema>;

export default function AdminSetup() {
  const [, setLocation] = useLocation();
  const [setupComplete, setSetupComplete] = useState(false);

  const { data: setupStatus, isLoading: checkingStatus } = useQuery<{ setupRequired: boolean; hasAdmin: boolean }>({
    queryKey: ["/api/setup/status"],
  });

  const form = useForm<AdminSetupForm>({
    resolver: zodResolver(adminSetupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: Omit<AdminSetupForm, "confirmPassword">) => {
      const response = await apiRequest("POST", "/api/setup/admin", {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      return response.json();
    },
    onSuccess: () => {
      setSetupComplete(true);
      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    },
  });

  const onSubmit = (data: AdminSetupForm) => {
    const { confirmPassword, ...adminData } = data;
    createAdminMutation.mutate(adminData);
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (setupStatus && !setupStatus.setupRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <CardTitle>Setup Already Complete</CardTitle>
            <CardDescription>
              An admin account already exists. This setup page is no longer available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/auth")}
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <CardTitle>Admin Account Created!</CardTitle>
            <CardDescription>
              Your admin account has been set up successfully. Redirecting to login...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/auth")}
              data-testid="button-go-to-login-after-setup"
            >
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <ShieldCheck className="h-12 w-12 mx-auto text-primary mb-4" />
          <CardTitle>Initial Admin Setup</CardTitle>
          <CardDescription>
            Welcome to Wolf Mother Wellness! Create your first admin account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {createAdminMutation.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(createAdminMutation.error as any)?.message || "Failed to create admin account. Please try again."}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Chana" 
                          {...field} 
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Spahr" 
                          {...field} 
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="admin@wolfmothertulsa.com" 
                        {...field} 
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Min. 8 characters" 
                        {...field} 
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Re-enter password" 
                        {...field} 
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={createAdminMutation.isPending}
                data-testid="button-create-admin"
              >
                {createAdminMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Admin...
                  </>
                ) : (
                  "Create Admin Account"
                )}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            This page is only available when no admin accounts exist.
            After creating your admin account, this page will be disabled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
