import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Smartphone, Lock, ArrowLeft } from "lucide-react";

const requestSchema = z.object({
  phoneNumber: z.string().min(10, "Please enter a valid phone number"),
});

const verifySchema = z.object({
  code: z.string().length(6, "Reset code must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RequestForm = z.infer<typeof requestSchema>;
type VerifyForm = z.infer<typeof verifySchema>;

interface SMSResetFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function SMSResetForm({ onBack, onSuccess }: SMSResetFormProps) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [phoneNumber, setPhoneNumber] = useState('');
  const { toast } = useToast();

  const requestForm = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const verifyForm = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (data: RequestForm) => {
      const response = await apiRequest("POST", "/api/auth/reset-password/sms/request", {
        phoneNumber: data.phoneNumber,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reset code");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setStep('verify');
      toast({
        title: "Reset Code Sent",
        description: "Please check your phone for the 6-digit reset code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: VerifyForm) => {
      const response = await apiRequest("POST", "/api/auth/reset-password/sms/verify", {
        phoneNumber: phoneNumber,
        code: data.code,
        newPassword: data.newPassword,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRequest = (data: RequestForm) => {
    setPhoneNumber(data.phoneNumber);
    requestMutation.mutate(data);
  };

  const handleVerify = (data: VerifyForm) => {
    verifyMutation.mutate(data);
  };

  if (step === 'request') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Reset Password via SMS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your phone number to receive a reset code
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(handleRequest)} className="space-y-4">
              <FormField
                control={requestForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+1 (777) WOLF-MOM"
                        {...field}
                        disabled={requestMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full wellness-button-primary"
                  disabled={requestMutation.isPending}
                >
                  {requestMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Smartphone className="h-4 w-4 mr-2" />
                  )}
                  Send Reset Code
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onBack}
                  disabled={requestMutation.isPending}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Enter Reset Code</CardTitle>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to {phoneNumber}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...verifyForm}>
          <form onSubmit={verifyForm.handleSubmit(handleVerify)} className="space-y-4">
            <FormField
              control={verifyForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="777777"
                      maxLength={6}
                      {...field}
                      disabled={verifyMutation.isPending}
                      className="text-center text-lg tracking-wider"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={verifyForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Wolf's protective secret"
                      {...field}
                      disabled={verifyMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={verifyForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm the sacred code"
                      {...field}
                      disabled={verifyMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full wellness-button-primary"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Reset Password
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStep('request')}
                disabled={verifyMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Change Phone Number
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}