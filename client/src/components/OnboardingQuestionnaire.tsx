import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Upload, FileText, CheckCircle2 } from "lucide-react";

interface OnboardingQuestionnaireProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
  userName: string;
}

interface OnboardingData {
  hasFloridaLicense: boolean;
  hasMultiStateLicense: boolean;
  selectedStates: string[];
  resumeFile?: File;
  licenseFile?: File;
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

export function OnboardingQuestionnaire({ open, onComplete, userId, userName }: OnboardingQuestionnaireProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    hasFloridaLicense: false,
    hasMultiStateLicense: false,
    selectedStates: [],
  });
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Welcome aboard! 🎉",
        description: "Jason will greet you shortly in your assigned channels.",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Oops!",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (step === 1 && !data.hasFloridaLicense && !data.hasMultiStateLicense) {
      toast({
        title: "Please select an option",
        description: "Let us know about your licensing status to continue.",
        variant: "destructive",
      });
      return;
    }

    if (step === 2 && data.hasMultiStateLicense && data.selectedStates.length === 0) {
      toast({
        title: "Select your states",
        description: "Please select at least one state where you're licensed.",
        variant: "destructive",
      });
      return;
    }

    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('hasFloridaLicense', String(data.hasFloridaLicense));
    formData.append('hasMultiStateLicense', String(data.hasMultiStateLicense));
    formData.append('selectedStates', JSON.stringify(data.selectedStates));
    
    if (data.resumeFile) {
      formData.append('resume', data.resumeFile);
    }
    
    if (data.licenseFile) {
      formData.append('license', data.licenseFile);
    }

    submitMutation.mutate(formData);
  };

  const toggleState = (state: string) => {
    setData(prev => ({
      ...prev,
      selectedStates: prev.selectedStates.includes(state)
        ? prev.selectedStates.filter(s => s !== state)
        : [...prev.selectedStates, state]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onComplete()}>
      <DialogContent className="sm:max-w-[600px] bg-black/90 border-cyan-500/30 text-white" data-testid="dialog-onboarding">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-cyan-400" data-testid="text-onboarding-title">
            Welcome to The Insurance School, {userName}! 🎓
          </DialogTitle>
          <DialogDescription className="text-gray-300" data-testid="text-onboarding-description">
            Let's get you set up in the right channels. This will only take a minute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full transition-colors ${
                  s === step ? 'bg-cyan-500' : s < step ? 'bg-cyan-600' : 'bg-gray-700'
                }`}
                data-testid={`progress-step-${s}`}
              />
            ))}
          </div>

          {/* Step 1: Florida License */}
          {step === 1 && (
            <div className="space-y-4" data-testid="step-florida-license">
              <h3 className="text-xl font-semibold text-cyan-300">Do you have a Florida Insurance License?</h3>
              <RadioGroup
                value={data.hasFloridaLicense ? "yes" : "no"}
                onValueChange={(value) => setData({ ...data, hasFloridaLicense: value === "yes" })}
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors" data-testid="radio-florida-yes">
                  <RadioGroupItem value="yes" id="fl-yes" />
                  <Label htmlFor="fl-yes" className="flex-1 cursor-pointer">
                    ✅ Yes, I'm already licensed in Florida (2-15 or equivalent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors" data-testid="radio-florida-no">
                  <RadioGroupItem value="no" id="fl-no" />
                  <Label htmlFor="fl-no" className="flex-1 cursor-pointer">
                    🎓 No, I need to get licensed (We'll help you!)
                  </Label>
                </div>
              </RadioGroup>
              
              {data.hasFloridaLicense && (
                <p className="text-sm text-cyan-400 bg-cyan-950/30 p-3 rounded-lg" data-testid="text-florida-licensed-message">
                  🎉 Awesome! You're ahead of the curve. You'll have access to immediate opportunities!
                </p>
              )}
              
              {!data.hasFloridaLicense && (
                <p className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg" data-testid="text-florida-unlicensed-message">
                  No worries! Our next 2-15 licensing class will get you ready. Total state fees: <span className="text-cyan-400 font-semibold">$55 + $70 + $44</span>
                </p>
              )}
            </div>
          )}

          {/* Step 2: Multi-State License */}
          {step === 2 && (
            <div className="space-y-4" data-testid="step-multistate-license">
              <h3 className="text-xl font-semibold text-cyan-300">Are you licensed in multiple states?</h3>
              <RadioGroup
                value={data.hasMultiStateLicense ? "yes" : "no"}
                onValueChange={(value) => setData({ ...data, hasMultiStateLicense: value === "yes" })}
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors" data-testid="radio-multistate-yes">
                  <RadioGroupItem value="yes" id="ms-yes" />
                  <Label htmlFor="ms-yes" className="flex-1 cursor-pointer">
                    🌎 Yes, I have licenses in multiple states
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors" data-testid="radio-multistate-no">
                  <RadioGroupItem value="no" id="ms-no" />
                  <Label htmlFor="ms-no" className="flex-1 cursor-pointer">
                    📍 No, just Florida (or working on it)
                  </Label>
                </div>
              </RadioGroup>

              {data.hasMultiStateLicense && (
                <div className="space-y-3" data-testid="container-state-selection">
                  <p className="text-sm text-cyan-400">Select all states where you're licensed:</p>
                  <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 space-y-2">
                    {US_STATES.map((state) => (
                      <div key={state} className="flex items-center space-x-2" data-testid={`checkbox-state-${state.toLowerCase().replace(' ', '-')}`}>
                        <Checkbox
                          id={`state-${state}`}
                          checked={data.selectedStates.includes(state)}
                          onCheckedChange={() => toggleState(state)}
                        />
                        <Label htmlFor={`state-${state}`} className="cursor-pointer text-sm">
                          {state}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500" data-testid="text-states-selected">
                    {data.selectedStates.length} state{data.selectedStates.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: File Uploads */}
          {step === 3 && (
            <div className="space-y-4" data-testid="step-file-uploads">
              <h3 className="text-xl font-semibold text-cyan-300">Upload Your Documents (Optional)</h3>
              <p className="text-sm text-gray-400">
                Help us understand your background better. These uploads will automatically update your profile.
              </p>

              <div className="space-y-3">
                <div className="border border-gray-700 rounded-lg p-4 space-y-2" data-testid="container-resume-upload">
                  <Label className="flex items-center gap-2 text-cyan-400">
                    <FileText className="w-4 h-4" />
                    Resume / CV
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setData({ ...data, resumeFile: e.target.files?.[0] })}
                    className="bg-gray-900 border-gray-700 text-white"
                    data-testid="input-resume-file"
                  />
                  {data.resumeFile && (
                    <p className="text-xs text-green-400 flex items-center gap-1" data-testid="text-resume-uploaded">
                      <CheckCircle2 className="w-3 h-3" /> {data.resumeFile.name}
                    </p>
                  )}
                </div>

                <div className="border border-gray-700 rounded-lg p-4 space-y-2" data-testid="container-license-upload">
                  <Label className="flex items-center gap-2 text-cyan-400">
                    <Upload className="w-4 h-4" />
                    Insurance License (if applicable)
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setData({ ...data, licenseFile: e.target.files?.[0] })}
                    className="bg-gray-900 border-gray-700 text-white"
                    data-testid="input-license-file"
                  />
                  {data.licenseFile && (
                    <p className="text-xs text-green-400 flex items-center gap-1" data-testid="text-license-uploaded">
                      <CheckCircle2 className="w-3 h-3" /> {data.licenseFile.name}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                💡 Tip: Uploading your documents helps Jason and the team provide personalized support!
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-800">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || submitMutation.isPending}
            className="border-gray-700 text-gray-400 hover:bg-gray-800"
            data-testid="button-back"
          >
            Back
          </Button>

          {step < 3 ? (
            <Button
              onClick={handleNext}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="button-next"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
              data-testid="button-complete"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                "Complete Onboarding 🚀"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
