import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle, Phone, Lock, KeyRound, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  code: z.string().length(6, "Please enter the 6-digit code"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "code" | "success" | "call">("email");
  const [phoneLastFour, setPhoneLastFour] = useState<string>("");
  const { toast } = useToast();

  const emailForm = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const requestCodeMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const res = await apiRequest("POST", "/api/password-reset-request", data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.phoneLastFour) {
        setPhoneLastFour(data.phoneLastFour);
        setStep("code");
        toast({
          title: "Code Sent",
          description: `A reset code has been sent to your phone ending in ${data.phoneLastFour}.`,
        });
      } else if (data.needsPhoneCall) {
        setStep("call");
      } else {
        toast({
          title: "Request Received",
          description: data.message || "If an account exists with this email, a reset code will be sent.",
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

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      const res = await apiRequest("POST", "/api/password-reset", {
        token: data.code,
        newPassword: data.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      setStep("success");
      toast({
        title: "Password Updated",
        description: "Your password has been successfully reset.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onEmailSubmit = (data: ForgotPasswordForm) => {
    requestCodeMutation.mutate(data);
  };

  const onResetSubmit = (data: ResetPasswordForm) => {
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/auth">
            <Button variant="ghost" className="text-slate-300 hover:text-white mb-4" data-testid="button-back-to-login">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Wolf Mother</h1>
          <p className="text-slate-400">Thermal Wellness Center</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white" data-testid="text-card-title">
              {step === "email" && "Reset Password"}
              {step === "code" && "Enter Reset Code"}
              {step === "success" && "Password Updated"}
              {step === "call" && "Give Us a Call"}
            </CardTitle>
            <CardDescription className="text-slate-400" data-testid="text-card-description">
              {step === "email" && "Enter your email and we'll text you a reset code"}
              {step === "code" && `Enter the 6-digit code sent to ***-***-${phoneLastFour}`}
              {step === "success" && "Your password has been successfully updated"}
              {step === "call" && "We need to verify your identity over the phone"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                      data-testid="input-email"
                      {...emailForm.register("email")}
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <p className="text-sm text-red-400" data-testid="text-error-email">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-400">
                    A 6-digit code will be sent to the phone number on your account
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  disabled={requestCodeMutation.isPending}
                  data-testid="button-send-code"
                >
                  {requestCodeMutation.isPending ? "Sending..." : "Send Reset Code"}
                </Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-white">6-Digit Code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 text-center text-2xl tracking-widest"
                      data-testid="input-code"
                      {...resetForm.register("code")}
                    />
                  </div>
                  {resetForm.formState.errors.code && (
                    <p className="text-sm text-red-400" data-testid="text-error-code">{resetForm.formState.errors.code.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                      data-testid="input-new-password"
                      {...resetForm.register("newPassword")}
                    />
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-400" data-testid="text-error-password">{resetForm.formState.errors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                      data-testid="input-confirm-password"
                      {...resetForm.register("confirmPassword")}
                    />
                  </div>
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-400" data-testid="text-error-confirm">{resetForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  {resetPasswordMutation.isPending ? "Updating..." : "Reset Password"}
                </Button>

                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={() => {
                    setStep("email");
                    resetForm.reset();
                  }}
                  data-testid="button-try-different-email"
                >
                  Try different email
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                <div className="space-y-2">
                  <p className="text-slate-300">
                    Your password has been successfully updated.
                  </p>
                  <p className="text-sm text-slate-400">
                    You can now log in with your new password.
                  </p>
                </div>
                <Link href="/auth">
                  <Button 
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                    data-testid="button-go-to-login"
                  >
                    Go to Login
                  </Button>
                </Link>
              </div>
            )}

            {step === "call" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                  <PhoneCall className="h-8 w-8 text-amber-500" />
                </div>
                <div className="space-y-3">
                  <p className="text-slate-300">
                    We don't have a phone number on file for your account.
                  </p>
                  <p className="text-slate-400 text-sm">
                    To reset your password, please call us and our staff will help verify your identity and reset your password.
                  </p>
                  <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-sm text-slate-400 mb-1">Call us at:</p>
                    <a 
                      href="tel:+15551234567" 
                      className="text-xl font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      (555) 123-4567
                    </a>
                    <p className="text-xs text-slate-500 mt-2">
                      Available during business hours
                    </p>
                  </div>
                </div>
                <Link href="/auth">
                  <Button 
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                    data-testid="button-back-to-login-from-call"
                  >
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
