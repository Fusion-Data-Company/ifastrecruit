import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface BookingData {
  candidateId: string;
  name: string;
}

export default function Booking() {
  const { token } = useParams<{ token: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [bookingType, setBookingType] = useState<string>("video");

  const { data: candidateData, isLoading } = useQuery<BookingData>({
    queryKey: ["/booking", token],
    enabled: !!token,
  });

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/calendar/slots", selectedDate?.toISOString()],
    enabled: !!selectedDate,
  });

  const bookInterviewMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await apiRequest("POST", "/api/bookings", bookingData);
      return response.json();
    },
    onSuccess: () => {
      // Show success message
    },
  });

  const handleBookInterview = async () => {
    if (!candidateData || !selectedDate || !selectedTime) return;

    const [startTime, endTime] = selectedTime.split("-");
    const startTs = new Date(selectedDate);
    const endTs = new Date(selectedDate);
    
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    
    startTs.setHours(startHour, startMin, 0, 0);
    endTs.setHours(endHour, endMin, 0, 0);

    await bookInterviewMutation.mutateAsync({
      candidateId: candidateData.candidateId,
      startTs: startTs.toISOString(),
      endTs: endTs.toISOString(),
      location: bookingType === "video" ? "Video Call" : "In-Person",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-panel rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
          </div>
          <p className="text-muted-foreground">Loading booking portal...</p>
        </Card>
      </div>
    );
  }

  if (!candidateData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-panel rounded-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-destructive text-2xl"></i>
          </div>
          <h1 className="enterprise-heading text-xl font-bold mb-2">Invalid Booking Link</h1>
          <p className="text-muted-foreground">This booking link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="glow-hover" data-testid="button-back-dashboard">
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-bolt text-primary-foreground"></i>
              </div>
              <div>
                <h1 className="enterprise-heading text-lg text-foreground">iFast Broker</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/candidates">
              <Button variant="ghost" size="sm">
                <i className="fas fa-users mr-2"></i>
                Candidates
              </Button>
            </Link>
            <Link href="/interviews">
              <Button variant="ghost" size="sm">
                <i className="fas fa-calendar-alt mr-2"></i>
                Interviews
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="glass-panel rounded-lg p-6 mb-6"
        >
          <h1 className="enterprise-heading text-2xl font-bold mb-2">Schedule Your Interview</h1>
          <p className="text-muted-foreground mb-4">
            Hello <span className="font-semibold text-foreground" data-testid="candidate-name">{candidateData.name}</span>! 
            Select a time that works best for you. You'll receive a calendar invite with all the details.
          </p>
          
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <span className="text-muted-foreground">Powered by iFast Broker Scheduling</span>
          </div>
        </motion.div>

        {/* Booking Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Calendar */}
          <Card className="glass-panel p-6 rounded-lg">
            <h3 className="enterprise-heading text-lg font-semibold mb-4">Select Date</h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
              className="rounded-md border border-border"
              data-testid="booking-calendar"
            />
          </Card>

          {/* Time Selection */}
          <Card className="glass-panel p-6 rounded-lg">
            <h3 className="enterprise-heading text-lg font-semibold mb-4">Interview Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Interview Type</label>
                <Select value={bookingType} onValueChange={setBookingType}>
                  <SelectTrigger className="glass-input" data-testid="booking-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Call</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="in-person">In-Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Available Times</label>
                {selectedDate ? (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Generate time slots */}
                    {[
                      "09:00-10:00", "10:00-11:00", "11:00-12:00",
                      "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00"
                    ].map((timeSlot) => (
                      <Button
                        key={timeSlot}
                        variant={selectedTime === timeSlot ? "default" : "outline"}
                        className={`glass-input text-sm glow-hover ${
                          selectedTime === timeSlot 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setSelectedTime(timeSlot)}
                        data-testid={`time-slot-${timeSlot}`}
                      >
                        {timeSlot}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Please select a date first</p>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  onClick={handleBookInterview}
                  disabled={!selectedDate || !selectedTime || bookInterviewMutation.isPending}
                  className="w-full bg-accent text-accent-foreground py-3 rounded-lg font-semibold glow-hover"
                  data-testid="confirm-booking-button"
                >
                  {bookInterviewMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Booking Interview...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-calendar-check mr-2"></i>
                      Confirm Interview Booking
                    </>
                  )}
                </Button>
              </div>

              {bookInterviewMutation.isSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-input p-4 rounded-lg text-center"
                >
                  <i className="fas fa-check-circle text-accent text-2xl mb-2"></i>
                  <h4 className="font-semibold mb-1">Interview Booked Successfully!</h4>
                  <p className="text-sm text-muted-foreground">
                    You'll receive a calendar invite with all the details shortly.
                  </p>
                </motion.div>
              )}

              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>• Interview duration: 60 minutes</p>
                <p>• You'll receive an ICS calendar file</p>
                <p>• Confirmation email will follow</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            Questions? Contact us at interviews@ifast-broker.com
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
