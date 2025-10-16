import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle,
  Sparkles,
  Shield,
  Star,
  Globe,
  Calendar,
  BookOpen,
  Users,
  TrendingUp,
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  isOpen: boolean;
  userId: string;
  onComplete: (tier: string) => void;
}

interface OnboardingAnswers {
  licenseStatus: 'fl_licensed' | 'multi_state' | 'non_licensed' | '';
  licenseDuration?: string;
  licenseLines?: string[];
  licensedStates?: string[];
  interestedInFlorida?: boolean;
  studyingForExam?: boolean;
  examTimeline?: string;
  careerGoals?: string[];
  yearsExperience?: string;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

export function OnboardingModal({ isOpen, userId, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    licenseStatus: '',
    licenseLines: [],
    licensedStates: [],
    careerGoals: []
  });

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const submitOnboarding = useMutation({
    mutationFn: async () => {
      // Determine tier based on answers
      let tier = 'NON_LICENSED';
      if (answers.licenseStatus === 'fl_licensed') {
        tier = 'FL_LICENSED';
      } else if (answers.licenseStatus === 'multi_state') {
        tier = 'MULTI_STATE';
      }

      const response = await apiRequest('POST', '/api/user/onboarding', {
        userId,
        answers,
        tier
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      // Complete onboarding
      queryClient.invalidateQueries({ queryKey: ['/api/user/onboarding-status'] });
      onComplete(data.tier);
    }
  });

  const handleNext = () => {
    if (currentStep === totalSteps) {
      submitOnboarding.mutate();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true; // Welcome step
      case 2:
        return answers.licenseStatus !== '';
      case 3:
        // Conditional validation based on license status
        if (answers.licenseStatus === 'fl_licensed') {
          return answers.licenseDuration && answers.licenseLines && answers.licenseLines.length > 0;
        } else if (answers.licenseStatus === 'multi_state') {
          return answers.licensedStates && answers.licensedStates.length > 0 && 
                 answers.interestedInFlorida !== undefined;
        } else if (answers.licenseStatus === 'non_licensed') {
          return answers.studyingForExam !== undefined && 
                 (answers.studyingForExam === false || answers.examTimeline);
        }
        return false;
      case 4:
        return answers.careerGoals && answers.careerGoals.length > 0 && 
               answers.yearsExperience !== undefined;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        // Welcome Step
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 text-center"
          >
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400 to-purple-600 opacity-20"></div>
                <Sparkles className="h-20 w-20 text-cyan-400 relative z-10" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                Welcome to iFast Recruit!
              </h2>
              <p className="text-gray-400 text-lg">
                Let's get you set up with the right resources and community
              </p>
            </div>

            <Card className="bg-white/5 border-white/10 p-6 space-y-4 backdrop-blur-sm">
              <p className="text-gray-300">
                This quick questionnaire will help us understand your licensing status 
                and career goals, so we can connect you with the most relevant channels 
                and opportunities.
              </p>
              <div className="flex items-center justify-center space-x-2 text-cyan-400">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">Takes less than 2 minutes</span>
              </div>
            </Card>
          </motion.div>
        );

      case 2:
        // License Status Step
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Your License Status</h3>
              <p className="text-gray-400">
                Do you currently hold a Florida insurance license?
              </p>
            </div>

            <RadioGroup
              value={answers.licenseStatus}
              onValueChange={(value: any) => setAnswers({ ...answers, licenseStatus: value })}
              className="space-y-3"
            >
              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setAnswers({ ...answers, licenseStatus: 'fl_licensed' })}>
                <Label className="flex items-center space-x-3 p-4 cursor-pointer">
                  <RadioGroupItem value="fl_licensed" />
                  <Shield className="h-5 w-5 text-blue-400" />
                  <span className="text-white">Yes, I have a Florida license</span>
                </Label>
              </Card>

              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setAnswers({ ...answers, licenseStatus: 'multi_state' })}>
                <Label className="flex items-center space-x-3 p-4 cursor-pointer">
                  <RadioGroupItem value="multi_state" />
                  <Globe className="h-5 w-5 text-purple-400" />
                  <span className="text-white">I have licenses in other states</span>
                </Label>
              </Card>

              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setAnswers({ ...answers, licenseStatus: 'non_licensed' })}>
                <Label className="flex items-center space-x-3 p-4 cursor-pointer">
                  <RadioGroupItem value="non_licensed" />
                  <Star className="h-5 w-5 text-yellow-400" />
                  <span className="text-white">No, but I'm interested in getting one</span>
                </Label>
              </Card>
            </RadioGroup>
          </motion.div>
        );

      case 3:
        // License Details Step (conditional based on status)
        if (answers.licenseStatus === 'fl_licensed') {
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">License Details</h3>
                <p className="text-gray-400">Tell us more about your Florida license</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">How long have you been licensed?</Label>
                  <RadioGroup
                    value={answers.licenseDuration}
                    onValueChange={(value) => setAnswers({ ...answers, licenseDuration: value })}
                    className="space-y-2"
                  >
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="less-1" />
                      <span className="text-gray-300">Less than 1 year</span>
                    </Label>
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="1-3" />
                      <span className="text-gray-300">1-3 years</span>
                    </Label>
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="3-5" />
                      <span className="text-gray-300">3-5 years</span>
                    </Label>
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="5-plus" />
                      <span className="text-gray-300">5+ years</span>
                    </Label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">What lines are you licensed for?</Label>
                  <div className="space-y-2">
                    {['Life', 'Health', 'Property', 'Casualty'].map((line) => (
                      <Label key={line} className="flex items-center space-x-2">
                        <Checkbox
                          checked={answers.licenseLines?.includes(line)}
                          onCheckedChange={(checked) => {
                            const lines = answers.licenseLines || [];
                            if (checked) {
                              setAnswers({ ...answers, licenseLines: [...lines, line] });
                            } else {
                              setAnswers({ ...answers, licenseLines: lines.filter(l => l !== line) });
                            }
                          }}
                        />
                        <span className="text-gray-300">{line}</span>
                      </Label>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        } else if (answers.licenseStatus === 'multi_state') {
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Multi-State Licensing</h3>
                <p className="text-gray-400">Which states are you licensed in?</p>
              </div>

              <ScrollArea className="h-64 w-full rounded-md border border-white/10 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {US_STATES.map((state) => (
                    <Label key={state} className="flex items-center space-x-2">
                      <Checkbox
                        checked={answers.licensedStates?.includes(state)}
                        onCheckedChange={(checked) => {
                          const states = answers.licensedStates || [];
                          if (checked) {
                            setAnswers({ ...answers, licensedStates: [...states, state] });
                          } else {
                            setAnswers({ ...answers, licensedStates: states.filter(s => s !== state) });
                          }
                        }}
                      />
                      <span className="text-gray-300 text-sm">{state}</span>
                    </Label>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-2">
                <Label className="text-gray-300">Are you interested in getting a Florida license?</Label>
                <RadioGroup
                  value={answers.interestedInFlorida ? 'yes' : 'no'}
                  onValueChange={(value) => setAnswers({ ...answers, interestedInFlorida: value === 'yes' })}
                  className="space-y-2"
                >
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" />
                    <span className="text-gray-300">Yes, I'm interested</span>
                  </Label>
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="no" />
                    <span className="text-gray-300">No, not at this time</span>
                  </Label>
                </RadioGroup>
              </div>
            </motion.div>
          );
        } else {
          // Non-licensed path
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Getting Started</h3>
                <p className="text-gray-400">Let's understand where you are in your journey</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Are you currently studying for the Florida exam?</Label>
                  <RadioGroup
                    value={answers.studyingForExam ? 'yes' : 'no'}
                    onValueChange={(value) => setAnswers({ ...answers, studyingForExam: value === 'yes' })}
                    className="space-y-2"
                  >
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" />
                      <span className="text-gray-300">Yes, I'm studying</span>
                    </Label>
                    <Label className="flex items-center space-x-2">
                      <RadioGroupItem value="no" />
                      <span className="text-gray-300">No, not yet</span>
                    </Label>
                  </RadioGroup>
                </div>

                {answers.studyingForExam && (
                  <div className="space-y-2">
                    <Label className="text-gray-300">When do you plan to take the exam?</Label>
                    <RadioGroup
                      value={answers.examTimeline}
                      onValueChange={(value) => setAnswers({ ...answers, examTimeline: value })}
                      className="space-y-2"
                    >
                      <Label className="flex items-center space-x-2">
                        <RadioGroupItem value="this-month" />
                        <span className="text-gray-300">This month</span>
                      </Label>
                      <Label className="flex items-center space-x-2">
                        <RadioGroupItem value="1-3-months" />
                        <span className="text-gray-300">1-3 months</span>
                      </Label>
                      <Label className="flex items-center space-x-2">
                        <RadioGroupItem value="3-6-months" />
                        <span className="text-gray-300">3-6 months</span>
                      </Label>
                      <Label className="flex items-center space-x-2">
                        <RadioGroupItem value="unsure" />
                        <span className="text-gray-300">Not sure yet</span>
                      </Label>
                    </RadioGroup>
                  </div>
                )}
              </div>
            </motion.div>
          );
        }

      case 4:
        // Career Goals Step
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Career Goals</h3>
              <p className="text-gray-400">What are your primary career goals?</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Select all that apply:</Label>
                <div className="space-y-3">
                  {[
                    { value: 'agency', label: 'Build my own agency', icon: TrendingUp },
                    { value: 'team', label: 'Join an established team', icon: Users },
                    { value: 'independent', label: 'Work independently', icon: Trophy },
                    { value: 'learn', label: 'Learn the industry', icon: BookOpen }
                  ].map((goal) => (
                    <Card key={goal.value} 
                          className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                      <Label className="flex items-center space-x-3 p-3 cursor-pointer">
                        <Checkbox
                          checked={answers.careerGoals?.includes(goal.value)}
                          onCheckedChange={(checked) => {
                            const goals = answers.careerGoals || [];
                            if (checked) {
                              setAnswers({ ...answers, careerGoals: [...goals, goal.value] });
                            } else {
                              setAnswers({ ...answers, careerGoals: goals.filter(g => g !== goal.value) });
                            }
                          }}
                        />
                        <goal.icon className="h-5 w-5 text-cyan-400" />
                        <span className="text-gray-300">{goal.label}</span>
                      </Label>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Years of experience in insurance?</Label>
                <RadioGroup
                  value={answers.yearsExperience}
                  onValueChange={(value) => setAnswers({ ...answers, yearsExperience: value })}
                  className="space-y-2"
                >
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="none" />
                    <span className="text-gray-300">No experience</span>
                  </Label>
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="less-1" />
                    <span className="text-gray-300">Less than 1 year</span>
                  </Label>
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="1-3" />
                    <span className="text-gray-300">1-3 years</span>
                  </Label>
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="3-5" />
                    <span className="text-gray-300">3-5 years</span>
                  </Label>
                  <Label className="flex items-center space-x-2">
                    <RadioGroupItem value="5-plus" />
                    <span className="text-gray-300">5+ years</span>
                  </Label>
                </RadioGroup>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900/95 backdrop-blur-xl border-white/10 text-white p-0 overflow-hidden">
        <div className="relative">
          {/* Glassmorphic Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
          
          {/* Content Container */}
          <div className="relative z-10 p-6">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Step {currentStep} of {totalSteps}</span>
                <span className="text-sm text-cyan-400">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/10" />
            </div>

            {/* Step Content with Animation */}
            <AnimatePresence mode="wait">
              <div className="min-h-[400px] flex flex-col">
                {renderStep()}
              </div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="text-gray-400 hover:text-white hover:bg-white/10"
                data-testid="button-onboarding-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={!canProceed() || submitOnboarding.isPending}
                className={cn(
                  "bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700",
                  "text-white border-0",
                  !canProceed() && "opacity-50 cursor-not-allowed"
                )}
                data-testid="button-onboarding-next"
              >
                {currentStep === 1 && (
                  <>
                    Let's Get Started
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
                {currentStep > 1 && currentStep < totalSteps && (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
                {currentStep === totalSteps && (
                  <>
                    {submitOnboarding.isPending ? 'Completing...' : 'Complete Setup'}
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}