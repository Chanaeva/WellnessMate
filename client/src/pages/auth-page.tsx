import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePageAmbient, useAudioEffects } from "@/hooks/use-audio-effects";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Lock, User, Smartphone, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import logoMossGreen from "@assets/WM Emblem Moss Green.png";
import { SMSResetForm } from "@/components/auth/sms-reset-form";

// Login schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Registration schema (extends insertUserSchema with password confirmation and age verification)
const registerSchema = insertUserSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    ageConfirmation: z.boolean().refine(val => val === true, {
      message: "You must be 18 years or older to register",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => {
    if (data.dateOfBirth) {
      const birthDate = new Date(data.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      return actualAge >= 18;
    }
    return true;
  }, {
    message: "You must be 18 years or older to register",
    path: ["dateOfBirth"],
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { playLoginSuccess, playError } = useAudioEffects();
  const [location, navigate] = useLocation();
  const isAdminLogin = location === "/admin-login";
  const [activeTab, setActiveTab] = useState<string>("login");

  // Check URL parameters to set default tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'register' || tab === 'login') {
      setActiveTab(tab);
    }
  }, []);
  const [showSMSReset, setShowSMSReset] = useState(false);

  // Set ambient sound for auth page
  usePageAmbient('auth');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (isAdminLogin || user.role === "admin") {
        navigate("/admin");
      } else if (!user.membershipAgreementCompleted) {
        navigate("/membership-agreement");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate, isAdminLogin]);

  // Handle SMS reset success
  const handleSMSResetSuccess = () => {
    setShowSMSReset(false);
    setActiveTab("login");
  };

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      role: "member",
    },
  });

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: (response: any) => {
        playLoginSuccess();
        // Use redirectTo from response or fallback to user status check
        if (response.redirectTo) {
          navigate(response.redirectTo);
        } else if (response.role === "admin") {
          navigate("/admin");
        } else if (!response.membershipAgreementCompleted) {
          navigate("/membership-agreement");
        } else {
          navigate("/dashboard");
        }
      },
      onError: () => {
        playError();
      }
    });
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    // Remove confirmPassword before submitting
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData, {
      onSuccess: (response: any) => {
        playLoginSuccess();
        if (response.redirectTo) {
          navigate(response.redirectTo);
        }
      },
      onError: () => {
        playError();
      }
    });
  };

  // Show SMS reset form if requested
  if (showSMSReset) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
            <SMSResetForm 
              onBack={() => setShowSMSReset(false)}
              onSuccess={handleSMSResetSuccess}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl w-full flex flex-col md:flex-row gap-8">
        {/* Left side: Auth forms */}
        <div className="md:w-1/2 lg:w-2/5">
          <Card className="wellness-card w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-center mb-4">
                <img
                  src={logoMossGreen}
                  alt="Wolf Mother Wellness"
                  className="h-16 w-16"
                />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl text-center font-heading">
                {isAdminLogin ? "Admin Access" : "Wolf Mother Wellness"}
              </CardTitle>
              <CardDescription className="text-center">
                {isAdminLogin
                  ? "Sign in to access the admin dashboard"
                  : "Manage your thermal wellness journey"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                defaultValue="login"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                {!isAdminLogin && (
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                )}

                {isAdminLogin && (
                  <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-sm text-primary">
                      <strong>Admin Login:</strong> Use your admin credentials
                      to access the dashboard and analytics.
                    </p>
                  </div>
                )}

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form
                      onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="wolf_foundling"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="password"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full wellness-button-primary"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Logging in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </Form>
                  <div className="text-center mt-4 space-y-2">
                    <div className="flex justify-center gap-4">
                      <Link href="/forgot-password">
                        <Button
                          variant="link"
                          className="text-sm text-muted-foreground p-0"
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Reset via Email
                        </Button>
                      </Link>
                      <Button
                        variant="link"
                        onClick={() => setShowSMSReset(true)}
                        className="text-sm text-muted-foreground p-0"
                      >
                        <Smartphone className="h-3 w-3 mr-1" />
                        Reset via SMS
                      </Button>
                    </div>
                    {!isAdminLogin && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Don't have an account?{" "}
                          <Button
                            variant="link"
                            onClick={() => setActiveTab("register")}
                            className="p-0"
                          >
                            Register here
                          </Button>
                        </p>
                        <div className="border-t border-border pt-3 mt-3">
                          <Link href="/admin-login">
                            <Button
                              variant="link"
                              className="text-sm text-primary p-0 font-medium"
                            >
                              Staff & Admin Login
                            </Button>
                          </Link>
                        </div>
                      </>
                    )}
                    {isAdminLogin && (
                      <div className="border-t pt-3 mt-3">
                        <Link href="/auth">
                          <Button
                            variant="link"
                            className="text-sm text-muted-foreground p-0"
                          >
                            ← Back to Member Login
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form
                      onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Romulus" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Lupus" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number (Optional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="+1 (777) WOLF-MOM"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="remus_warrior"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="email"
                                  placeholder="romulus@tiber.river"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="ageConfirmation"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="mt-1"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                I confirm that I am 18 years of age or older
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Wolf Mother Wellness is an adult-only facility. Membership is restricted to individuals 18 years and older.
                              </p>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="password"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="password"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>
                  </Form>
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Button
                        variant="link"
                        onClick={() => setActiveTab("login")}
                        className="p-0"
                      >
                        Login here
                      </Button>
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right side: Hero section */}
        <div className="md:w-1/2 lg:w-3/5 hidden md:block">
          <div className="h-full rounded-xl overflow-hidden relative">
            {/* Wellness center interior image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/apothecary-plants-bg.png')" }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/40"></div>
            <div className="relative p-8 flex flex-col h-full justify-between text-white">
              <div className="flex items-center justify-center mb-3">
                <img
                  src={logoMossGreen}
                  alt="Wolf Mother Wellness"
                  className="max-h-25 max-w-24 object-contain filter brightness-0 invert pt-6"
                />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading mb-4">
                  Welcome to Wolf Mother Wellness
                </h2>
                <p className="text-lg mb-6">
                  Your thermal wellness journey begins here. Our center offers
                  state-of-the-art thermal facilities designed to help you
                  achieve optimal health and relaxation.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="font-semibold mb-1">Thermal Facilities</h3>
                    <p className="text-sm">
                      Access to sauna, hot tubs, cold plunge and more
                    </p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="font-semibold mb-1">Wellness Guides</h3>
                    <p className="text-sm">
                      Expert guidance for thermal therapy
                    </p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="font-semibold mb-1">Flexible Plans</h3>
                    <p className="text-sm">
                      Choose a plan that fits your needs
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
