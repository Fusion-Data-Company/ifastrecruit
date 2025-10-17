import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const onboardingSchema = z.object({
  hasFloridaLicense: z.boolean(),
  isMultiStateLicensed: z.boolean(),
  licensedStates: z.array(z.string()).optional().default([])
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [completionMessage, setCompletionMessage] = useState<string>("");
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      hasFloridaLicense: false,
      isMultiStateLicensed: false,
      licensedStates: []
    }
  });

  const hasFloridaLicense = form.watch("hasFloridaLicense");
  const isMultiStateLicensed = form.watch("isMultiStateLicensed");

  const totalSteps = hasFloridaLicense ? (isMultiStateLicensed ? 3 : 2) : 1;
  const progress = (step / totalSteps) * 100;

  // Handle redirect when onboarding is complete
  useEffect(() => {
    if (shouldRedirect && completionMessage) {
      const redirectTimer = setTimeout(() => {
        try {
          console.log("Attempting to redirect to /messenger");
          navigate("/messenger");
        } catch (error) {
          console.error("Failed to navigate to messenger:", error);
          // Fallback to window.location if navigate fails
          window.location.href = "/messenger";
        }
      }, 2000);

      return () => clearTimeout(redirectTimer);
    }
  }, [shouldRedirect, completionMessage, navigate]);

  const completeMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      console.log("[Onboarding] Starting form submission with data:", data);
      
      // Create FormData because backend expects multipart/form-data
      const formData = new FormData();
      formData.append("hasFloridaLicense", String(data.hasFloridaLicense));
      formData.append("isMultiStateLicensed", String(data.isMultiStateLicensed));
      
      // Send licensed states as JSON string (backend expects this format)
      if (data.licensedStates && data.licensedStates.length > 0) {
        formData.append("licensedStates", JSON.stringify(data.licensedStates));
      }
      
      console.log("[Onboarding] Sending FormData to /api/onboarding/complete");
      console.log("[Onboarding] FormData contents:", {
        hasFloridaLicense: data.hasFloridaLicense,
        isMultiStateLicensed: data.isMultiStateLicensed,
        licensedStates: data.licensedStates
      });
      
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        body: formData,
        credentials: "include", // Important for authentication cookies
      });
      
      console.log("[Onboarding] Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Onboarding] Error response:", errorText);
        throw new Error(`Failed to complete onboarding: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("[Onboarding] Success response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[Onboarding] Mutation succeeded with data:", data);
      const channels = data.channels?.join(", ") || "your assigned channels";
      setCompletionMessage(`Welcome! You've been assigned to: ${channels}`);
      
      toast({
        title: "Onboarding Complete!",
        description: `You've been assigned to ${channels}`,
      });

      // Trigger the redirect through useEffect
      setShouldRedirect(true);
    },
    onError: (error: any) => {
      console.error("[Onboarding] Mutation failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to complete onboarding",
      });
    },
  });

  const handleNext = () => {
    console.log("[Onboarding] handleNext clicked, step:", step);
    console.log("[Onboarding] hasFloridaLicense:", hasFloridaLicense);
    console.log("[Onboarding] isMultiStateLicensed:", isMultiStateLicensed);
    
    if (step === 1 && !hasFloridaLicense) {
      // If no Florida license, skip to submission
      console.log("[Onboarding] No Florida license, submitting form");
      handleSubmit();
    } else if (step === 2 && !isMultiStateLicensed) {
      // If has FL license but not multi-state, submit
      console.log("[Onboarding] Has FL license but not multi-state, submitting form");
      handleSubmit();
    } else {
      console.log("[Onboarding] Moving to next step:", step + 1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    console.log("[Onboarding] Going back from step:", step, "to step:", step - 1);
    setStep(step - 1);
  };

  const handleSubmit = () => {
    console.log("[Onboarding] handleSubmit called");
    console.log("[Onboarding] Form errors before submit:", form.formState.errors);
    console.log("[Onboarding] Form values before submit:", form.getValues());
    
    form.handleSubmit((data) => {
      console.log("[Onboarding] Form validation passed, submitting with data:", data);
      completeMutation.mutate(data);
    }, (errors) => {
      console.error("[Onboarding] Form validation failed:", errors);
    })();
  };

  if (completionMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Success!</h2>
            <p className="text-muted-foreground">{completionMessage}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting to messenger...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle data-testid="onboarding-title">Welcome to iFast Recruiting</CardTitle>
          <CardDescription data-testid="onboarding-description">
            Let's get you set up with the right channels based on your licensing status
          </CardDescription>
          <Progress value={progress} className="mt-4" data-testid="progress-bar" />
          <p className="text-sm text-muted-foreground mt-2" data-testid="step-indicator">
            Step {step} of {totalSteps}
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              {step === 1 && (
                <FormField
                  control={form.control}
                  name="hasFloridaLicense"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg" data-testid="label-florida-license">
                        Do you have a Florida insurance broker license?
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(value === "true")}
                          value={field.value ? "true" : "false"}
                          className="flex flex-col space-y-2"
                          data-testid="radio-florida-license"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="true" data-testid="radio-florida-yes" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Yes, I have a Florida license
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="false" data-testid="radio-florida-no" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              No, I don't have a Florida license yet
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {step === 2 && hasFloridaLicense && (
                <FormField
                  control={form.control}
                  name="isMultiStateLicensed"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg" data-testid="label-multi-state">
                        Are you licensed in multiple states?
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(value === "true")}
                          value={field.value ? "true" : "false"}
                          className="flex flex-col space-y-2"
                          data-testid="radio-multi-state"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="true" data-testid="radio-multi-state-yes" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Yes, I'm licensed in multiple states
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="false" data-testid="radio-multi-state-no" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              No, only Florida
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {step === 3 && hasFloridaLicense && isMultiStateLicensed && (
                <FormField
                  control={form.control}
                  name="licensedStates"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-lg" data-testid="label-states">
                        Which states are you licensed in?
                      </FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto p-4 border rounded-md" data-testid="states-list">
                        {US_STATES.map((state) => (
                          <FormField
                            key={state}
                            control={form.control}
                            name="licensedStates"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={state}
                                  className="flex flex-row items-start space-x-2 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(state)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, state])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== state
                                              )
                                            );
                                      }}
                                      data-testid={`checkbox-state-${state.toLowerCase().replace(/\s+/g, '-')}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {state}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-between pt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                )}
                <div className={step === 1 ? "ml-auto" : ""}>
                  {step < totalSteps ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      data-testid="button-next"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        console.log("[Onboarding] Complete Onboarding button clicked");
                        console.log("[Onboarding] Current step:", step);
                        console.log("[Onboarding] Total steps:", totalSteps);
                        handleSubmit();
                      }}
                      disabled={completeMutation.isPending}
                      data-testid="button-submit"
                    >
                      {completeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        "Complete Onboarding"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
