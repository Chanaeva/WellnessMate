import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const waiverSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().optional(),
  waiverAgreed: z.boolean().refine((v) => v === true, {
    message: "You must agree to the waiver to continue",
  }),
});

type WaiverFormData = z.infer<typeof waiverSchema>;

interface WaiverQuestion {
  id: number;
  question: string;
  description: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function GuestWaiverPage() {
  const { toast } = useToast();
  const [showWaiverText, setShowWaiverText] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [guestName, setGuestName] = useState("");

  const { data: waiverQuestions = [] } = useQuery<WaiverQuestion[]>({
    queryKey: ["/api/waiver-questions"],
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<WaiverFormData>({
    resolver: zodResolver(waiverSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      waiverAgreed: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WaiverFormData) => {
      const answers = waiverQuestions.map((q) => ({
        questionId: q.id,
        answer: questionAnswers[q.id] ?? false,
      }));
      const response = await apiRequest("POST", "/api/kiosk/guest-waiver", {
        ...data,
        answers,
      });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      setGuestName(variables.firstName);
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit waiver. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WaiverFormData) => {
    const unanswered = waiverQuestions.filter(
      (q) => q.isRequired && !questionAnswers[q.id]
    );
    if (unanswered.length > 0) {
      toast({
        title: "Required Questions",
        description: "Please answer all required questions before continuing.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-20 w-20 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800">You're all set, {guestName}!</h1>
          <p className="text-stone-600 text-lg">
            Your waiver has been signed and saved. We look forward to seeing you at Wolf Mother Wellness!
          </p>
          <p className="text-stone-500 text-sm">
            You can close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div
        className="py-8 px-4 text-center"
        style={{ background: "linear-gradient(135deg, #4a5d4a 0%, #6b8e5a 100%)" }}
      >
        <h1 className="text-2xl font-bold text-white tracking-wide">Wolf Mother Wellness</h1>
        <p className="text-green-100 mt-1 text-sm">Guest Waiver</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <p className="text-center text-stone-600 mb-8">
          Please complete this form and sign the waiver before your first visit.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First name" {...field} />
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
                      <Input placeholder="Last name" {...field} />
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
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic waiver questions */}
            {waiverQuestions.length > 0 && (
              <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 space-y-3">
                <h4 className="font-semibold text-blue-800">Quick Questions</h4>
                {waiverQuestions.map((q) => (
                  <div key={q.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={`wq-${q.id}`}
                      checked={questionAnswers[q.id] ?? false}
                      onChange={(e) =>
                        setQuestionAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 mt-0.5 rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="leading-none">
                      <label
                        htmlFor={`wq-${q.id}`}
                        className="text-blue-900 font-medium cursor-pointer text-base"
                      >
                        {q.question}
                        {q.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {q.description && (
                        <p className="text-sm text-blue-600 mt-0.5">{q.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Liability Waiver */}
            <div className="border rounded-xl p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-amber-800">Liability Waiver</h4>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowWaiverText(!showWaiverText)}
                  className="text-amber-700 p-0 h-auto"
                >
                  {showWaiverText ? "Hide" : "Read Full Waiver"}
                </Button>
              </div>

              {showWaiverText && (
                <div className="text-sm text-amber-900 bg-white border border-amber-200 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                  <p className="mb-2 font-bold">
                    WOLF MOTHER WELLNESS LIABILITY WAIVER AND RELEASE
                  </p>
                  <p className="mb-2">
                    By signing this waiver, I acknowledge and agree to the following:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      I understand that the use of thermal pools, saunas, and other wellness
                      facilities involves inherent risks.
                    </li>
                    <li>
                      I am in good physical health and have no medical conditions that would
                      prevent me from safely using these facilities.
                    </li>
                    <li>I agree to follow all posted rules and staff instructions.</li>
                    <li>
                      I release Wolf Mother Wellness, its owners, employees, and agents from any
                      liability for injuries or damages that may occur during my visit.
                    </li>
                    <li>I am at least 18 years of age or have parental/guardian consent.</li>
                    <li>
                      I understand that alcohol consumption is prohibited before using the
                      facilities.
                    </li>
                  </ul>
                  <p className="mt-2">This waiver is valid for this visit only.</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="waiverAgreed"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-5 w-5 mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-amber-900 font-medium cursor-pointer">
                        I have read and agree to the liability waiver
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full py-6 text-lg"
              style={{ backgroundColor: "#4a5d4a" }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Submitting…" : "Sign Waiver"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
