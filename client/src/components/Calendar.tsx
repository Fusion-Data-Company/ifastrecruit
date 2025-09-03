import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { useMCPClient } from '@/lib/mcp-client';
import type { Candidate, Booking } from '@shared/schema';

const bookingSchema = z.object({
  candidateId: z.string().min(1, 'Please select a candidate'),
  title: z.string().min(1, 'Interview title is required'),
  location: z.string().min(1, 'Location is required'),
  notes: z.string().optional(),
  duration: z.number().min(15).max(240),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface CalendarProps {
  className?: string;
}

export default function Calendar({ className }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const queryClient = useQueryClient();
  const { callTool } = useMCPClient();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      candidateId: '',
      title: '',
      location: 'Video Call',
      notes: '',
      duration: 60,
    },
  });

  // Fetch bookings for calendar
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    refetchInterval: 30000,
  });

  // Fetch candidates for booking form
  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ['/api/candidates'],
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData & { startTs: Date; endTs: Date }) => {
      return await callTool('book_interview', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setIsBookingDialogOpen(false);
      form.reset();
      toast({
        title: 'Interview Scheduled',
        description: 'The interview has been successfully scheduled and confirmation sent.',
      });
    },
    onError: () => {
      toast({
        title: 'Scheduling Failed',
        description: 'There was an error scheduling the interview. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Transform bookings to FullCalendar events
  const calendarEvents = bookings.map(booking => ({
    id: booking.id,
    title: `Interview: ${candidates.find(c => c.id === booking.candidateId)?.name || 'Unknown'}`,
    start: booking.startTs,
    end: booking.endTs,
    backgroundColor: getEventColor(booking.status),
    borderColor: getEventColor(booking.status),
    extendedProps: {
      booking,
      candidate: candidates.find(c => c.id === booking.candidateId),
    },
  }));

  function getEventColor(status: string) {
    switch (status) {
      case 'CONFIRMED': return 'hsl(195, 92%, 50%)'; // primary color for confirmed
      case 'PENDING': return 'hsl(183, 100%, 67%)'; // accent color for pending
      case 'COMPLETED': return 'hsl(183, 100%, 67%)'; // accent cyan for completed
      case 'CANCELLED': return 'hsl(215, 20.2%, 65.1%)'; // muted-foreground for cancelled
      default: return 'hsl(203.8863, 88.2845%, 53.1373%)'; // chart-1 for default
    }
  }

  const handleDateSelect = (selectInfo: any) => {
    setSelectedDate(selectInfo.start);
    setIsBookingDialogOpen(true);
  };

  const handleEventClick = (clickInfo: any) => {
    setSelectedEvent(clickInfo.event);
  };

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedDate) return;

    const startTs = new Date(selectedDate);
    const endTs = new Date(startTs.getTime() + data.duration * 60000);

    createBookingMutation.mutate({
      ...data,
      startTs,
      endTs,
    });
  };

  return (
    <Card className={`glass-panel p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="enterprise-heading text-lg font-semibold">Interview Calendar</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="glass-input">
            <i className="fas fa-calendar-check mr-1"></i>
            {bookings.length} Scheduled
          </Badge>
          <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="glass-input glow-hover micro-animation"
                data-testid="schedule-interview-btn"
                onClick={() => setSelectedDate(new Date())}
              >
                <i className="fas fa-plus mr-2"></i>
                Schedule Interview
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border">
              <DialogHeader>
                <DialogTitle>Schedule New Interview</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="candidateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Candidate</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="Select a candidate" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {candidates.map((candidate) => (
                              <SelectItem key={candidate.id} value={candidate.id}>
                                {candidate.name} - {candidate.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interview Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Technical Interview" 
                            className="glass-input"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Video Call or Office" 
                              className="glass-input"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                            <FormControl>
                              <SelectTrigger className="glass-input">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="90">1.5 hours</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Interview notes or preparation instructions"
                            className="glass-input"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsBookingDialogOpen(false)}
                      className="glass-input"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createBookingMutation.isPending}
                      className="glass-input glow-hover"
                      data-testid="confirm-schedule-btn"
                    >
                      {createBookingMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                      ) : (
                        <i className="fas fa-calendar-plus mr-2"></i>
                      )}
                      Schedule Interview
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="calendar-container"
        style={{
          background: 'hsla(217, 32%, 17%, 0.08)',
          backdropFilter: 'blur(10px)',
          borderRadius: '18px',
          border: '1px solid hsla(217, 32%, 17%, 0.15)',
          boxShadow: '0 0 40px hsla(195, 92%, 50%, 0.3)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          '--fc-bg-event-color': 'hsla(195, 92%, 50%, 0.2)',
          '--fc-border-color': 'hsla(217, 32%, 17%, 0.15)',
          '--fc-button-text-color': 'hsl(213, 31%, 91%)',
          '--fc-button-bg-color': 'hsla(217, 32%, 17%, 0.1)',
          '--fc-button-border-color': 'hsla(217, 32%, 17%, 0.15)',
          '--fc-button-hover-bg-color': 'hsl(183, 100%, 67%)',
          '--fc-button-hover-border-color': 'hsl(183, 100%, 67%)',
          '--fc-button-active-bg-color': 'hsl(195, 92%, 50%)',
          '--fc-button-active-border-color': 'hsl(195, 92%, 50%)',
          '--fc-page-bg-color': 'transparent',
          '--fc-neutral-bg-color': 'hsla(217, 32%, 17%, 0.06)',
          '--fc-neutral-text-color': 'hsl(213, 31%, 91%)',
          '--fc-list-event-hover-bg-color': 'hsla(195, 92%, 50%, 0.1)',
        } as React.CSSProperties}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            initialView="timeGridWeek"
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            events={calendarEvents}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="auto"
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: '09:00',
              endTime: '17:00',
            }}
            eventDisplay="block"
            eventBackgroundColor="hsla(195, 92%, 50%, 0.3)"
            eventBorderColor="hsl(195, 92%, 50%)"
            eventTextColor="hsl(213, 31%, 91%)"
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            themeSystem="standard"
            eventClassNames="force-platform-event"
            dayHeaderClassNames="force-platform-header"
            data-testid="fullcalendar"
          />
        </div>
      </motion.div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="glass-panel border-border">
            <DialogHeader>
              <DialogTitle>Interview Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Interview Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Candidate:</span>
                    <span>{selectedEvent.extendedProps.candidate?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{selectedEvent.extendedProps.candidate?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date(selectedEvent.start).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span>
                      {new Date(selectedEvent.start).toLocaleTimeString()} - 
                      {new Date(selectedEvent.end).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span>{selectedEvent.extendedProps.booking?.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge style={{ backgroundColor: selectedEvent.backgroundColor }}>
                      {selectedEvent.extendedProps.booking?.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                <Button variant="ghost" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
                <Button className="glass-input glow-hover">
                  <i className="fas fa-edit mr-2"></i>
                  Edit Interview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}