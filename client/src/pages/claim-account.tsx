import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle, Phone, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const claimAccountSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const setPasswordSchema = z.object({
  code: z.string().length(6, "Please enter the 6-digit code"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ClaimAccountForm = z.infer<typeof claimAccountSchema>;
type SetPasswordForm = z.infer<typeof setPasswordSchema>;

export default function ClaimAccountPage() {
  const [step, setStep] = useState<"email" | "code" | "success">("email");
  const [phoneLastFour, setPhoneLastFour] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const { toast } = useToast();

  const emailForm = useForm<ClaimAccountForm>({
    resolver: zodResolver(claimAccountSchema),
    defaultValues: {
      email: "",
    },
  });

  const passwordForm = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const requestCodeMutation = useMutation({
    mutationFn: async (data: ClaimAccountForm) => {
      const res = await apiRequest("POST", "/api/claim-account/request", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setUserEmail(emailForm.getValues("email"));
      if (data.phoneLastFour) {
        setPhoneLastFour(data.phoneLastFour);
        setStep("code");
        toast({
          title: "Code Sent",
          description: `A verification code has been sent to your phone ending in ${data.phoneLastFour}.`,
        });
      } else if (data.needsPhone) {
        toast({
          title: "Phone Number Required",
          description: "Please contact staff at the front desk to add your phone number and set up your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account Not Found",
          description: data.message || "No account found with that email. Please check your email or visit our front desk.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: SetPasswordForm) => {
      const res = await apiRequest("POST", "/api/claim-account/verify", {
        email: userEmail,
        code: data.code,
        newPassword: data.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      setStep("success");
      toast({
        title: "Account Activated",
        description: "Your account is ready! You can now log in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEmailSubmit = (data: ClaimAccountForm) => {
    requestCodeMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: SetPasswordForm) => {
    setPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#556B2F]/10 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[#556B2F]/10 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-[#556B2F]" />
          </div>
          <CardTitle className="text-2xl">
            {step === "email" && "Claim Your Account"}
            {step === "code" && "Verify Your Phone"}
            {step === "success" && "Account Ready!"}
          </CardTitle>
          <CardDescription>
            {step === "email" && "Set up your portal login to access your membership online"}
            {step === "code" && "Enter the code sent to your phone"}
            {step === "success" && "Your account has been activated"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "email" && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="Enter your email"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-[#556B2F] hover:bg-[#556B2F]/90"
                  disabled={requestCodeMutation.isPending}
                >
                  {requestCodeMutation.isPending ? "Sending..." : "Send Verification Code"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/auth" className="text-[#556B2F] hover:underline">
                    Sign In
                  </Link>
                </div>
              </form>
            </Form>
          )}

          {step === "code" && (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <div className="bg-[#556B2F]/10 rounded-lg p-3 text-sm text-center">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Code sent to ***-***-{phoneLastFour}
                </div>

                <FormField
                  control={passwordForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="text-center text-2xl tracking-widest"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Create Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Create a password"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Confirm your password"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-[#556B2F] hover:bg-[#556B2F]/90"
                  disabled={setPasswordMutation.isPending}
                >
                  {setPasswordMutation.isPending ? "Activating..." : "Activate Account"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("email")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </form>
            </Form>
          )}

          {step === "success" && (
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-muted-foreground">
                Your portal account is now active. You can sign in to view your membership, book sessions, and more.
              </p>
              <Link href="/auth">
                <Button className="w-full bg-[#556B2F] hover:bg-[#556B2F]/90">
                  Sign In Now
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
