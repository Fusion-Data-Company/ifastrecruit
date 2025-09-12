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

  // Helper function to create a synthetic title from booking data
  const getBookingTitle = (booking: Booking, candidate?: Candidate) => {
    // Create a meaningful title from available booking data
    const candidateName = candidate?.name || 'Unknown Candidate';
    const location = booking.location || 'Video Call';
    
    // Generate category-based title
    if (location.toLowerCase().includes('technical') || location.toLowerCase().includes('coding')) {
      return 'Technical Interview';
    } else if (location.toLowerCase().includes('final') || location.toLowerCase().includes('decision')) {
      return 'Final Interview';
    } else if (location.toLowerCase().includes('phone') || location.toLowerCase().includes('screening')) {
      return 'Phone Screening';
    } else if (location.toLowerCase().includes('follow') || location.toLowerCase().includes('callback')) {
      return 'Follow-up Interview';
    }
    
    return 'Interview'; // Default fallback
  };

  // Transform bookings to FullCalendar events with enhanced color coding
  const calendarEvents = (bookings || []).map(booking => {
    const candidate = (candidates || []).find(c => c.id === booking.candidateId);
    const syntheticTitle = getBookingTitle(booking, candidate);
    const eventStyle = getEventStyle(booking.status, syntheticTitle);
    const category = getEventCategory(syntheticTitle);
    
    return {
      id: booking.id,
      title: `${getEventIcon(booking.status)} ${syntheticTitle}: ${candidate?.name || 'Unknown'}`,
      start: booking.startTs,
      end: booking.endTs,
      backgroundColor: eventStyle.background,
      borderColor: eventStyle.border,
      textColor: eventStyle.text,
      classNames: [`status-${booking.status.toLowerCase()}`, `category-${category}`, 'elite-calendar-event'],
      extendedProps: {
        booking,
        candidate,
        priority: getEventPriority(booking.status),
        category: category,
        styleData: eventStyle,
        syntheticTitle: syntheticTitle,
      },
    };
  });

  function getEventStyle(status: string, title: string) {
    const category = getEventCategory(title);
    
    switch (status) {
      case 'CONFIRMED':
        return {
          background: 'linear-gradient(135deg, hsla(195, 92%, 50%, 0.25) 0%, hsla(203, 88%, 53%, 0.35) 100%)',
          border: 'hsl(195, 92%, 50%)',
          text: 'hsl(213, 31%, 91%)',
        };
      case 'PENDING':
        return {
          background: 'linear-gradient(135deg, hsla(42, 92%, 56%, 0.25) 0%, hsla(45, 100%, 60%, 0.35) 100%)',
          border: 'hsl(42, 92%, 56%)',
          text: 'hsl(213, 31%, 91%)',
        };
      case 'COMPLETED':
        return {
          background: 'linear-gradient(135deg, hsla(159, 100%, 36%, 0.25) 0%, hsla(160, 84%, 39%, 0.35) 100%)',
          border: 'hsl(159, 100%, 36%)',
          text: 'hsl(213, 31%, 91%)',
        };
      case 'CANCELLED':
        return {
          background: 'linear-gradient(135deg, hsla(341, 75%, 51%, 0.25) 0%, hsla(348, 83%, 47%, 0.35) 100%)',
          border: 'hsl(341, 75%, 51%)',
          text: 'hsl(213, 31%, 91%)',
        };
      case 'RESCHEDULED':
        return {
          background: 'linear-gradient(135deg, hsla(232, 78%, 42%, 0.25) 0%, hsla(240, 100%, 60%, 0.35) 100%)',
          border: 'hsl(232, 78%, 42%)',
          text: 'hsl(213, 31%, 91%)',
        };
      default:
        // Category-based coloring for new events
        if (category === 'technical') {
          return {
            background: 'linear-gradient(135deg, hsla(183, 100%, 67%, 0.25) 0%, hsla(195, 92%, 50%, 0.35) 100%)',
            border: 'hsl(183, 100%, 67%)',
            text: 'hsl(213, 31%, 91%)',
          };
        } else if (category === 'followup') {
          return {
            background: 'linear-gradient(135deg, hsla(270, 75%, 65%, 0.25) 0%, hsla(280, 80%, 60%, 0.35) 100%)',
            border: 'hsl(270, 75%, 65%)',
            text: 'hsl(213, 31%, 91%)',
          };
        } else if (category === 'final') {
          return {
            background: 'linear-gradient(135deg, hsla(320, 85%, 60%, 0.25) 0%, hsla(330, 90%, 55%, 0.35) 100%)',
            border: 'hsl(320, 85%, 60%)',
            text: 'hsl(213, 31%, 91%)',
          };
        }
        return {
          background: 'linear-gradient(135deg, hsla(217, 32%, 17%, 0.25) 0%, hsla(215, 28%, 25%, 0.35) 100%)',
          border: 'hsl(213, 20%, 75%)',
          text: 'hsl(213, 31%, 91%)',
        };
    }
  }

  function getEventIcon(status: string) {
    switch (status) {
      case 'CONFIRMED': return '✓';
      case 'PENDING': return '⏳';
      case 'COMPLETED': return '✅';
      case 'CANCELLED': return '❌';
      case 'RESCHEDULED': return '📅';
      default: return '📋';
    }
  }

  function getEventCategory(title: string) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('technical') || lowerTitle.includes('coding')) return 'technical';
    if (lowerTitle.includes('follow') || lowerTitle.includes('callback')) return 'followup';
    if (lowerTitle.includes('final') || lowerTitle.includes('decision')) return 'final';
    if (lowerTitle.includes('screening') || lowerTitle.includes('phone')) return 'screening';
    return 'standard';
  }

  function getEventPriority(status: string) {
    switch (status) {
      case 'CONFIRMED': return 'high';
      case 'PENDING': return 'medium';
      case 'RESCHEDULED': return 'high';
      case 'COMPLETED': return 'low';
      case 'CANCELLED': return 'low';
      default: return 'medium';
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
        <div className="flex items-center space-x-4">
          <h3 className="enterprise-heading text-xl font-bold bg-gradient-to-r from-primary via-accent to-chart-2 bg-clip-text text-transparent">
            Elite Interview Calendar
          </h3>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="glass-input border-primary/30 text-primary">
              <i className="fas fa-calendar-check mr-1"></i>
              {(bookings || []).length} Scheduled
            </Badge>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Color Legend */}
          <div className="flex items-center space-x-1 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, hsla(195, 92%, 50%, 0.6) 0%, hsla(203, 88%, 53%, 0.8) 100%)' }}></div>
              <span className="text-muted-foreground">Confirmed</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, hsla(42, 92%, 56%, 0.6) 0%, hsla(45, 100%, 60%, 0.8) 100%)' }}></div>
              <span className="text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, hsla(159, 100%, 36%, 0.6) 0%, hsla(160, 84%, 39%, 0.8) 100%)' }}></div>
              <span className="text-muted-foreground">Complete</span>
            </div>
          </div>
          
          <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="glass-input glow-hover micro-animation bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30 hover:from-primary/30 hover:to-accent/30"
                data-testid="schedule-interview-btn"
                onClick={() => setSelectedDate(new Date())}
              >
                <i className="fas fa-plus mr-2"></i>
                Schedule Elite Interview
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
                            {(candidates || []).map((candidate) => (
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
        className="calendar-container enterprise-calendar-wrapper"
        style={{
          background: 'linear-gradient(135deg, hsla(217, 32%, 17%, 0.12) 0%, hsla(215, 28%, 10%, 0.15) 50%, hsla(217, 32%, 17%, 0.12) 100%)',
          backdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius)',
          border: '1px solid hsla(195, 92%, 50%, 0.15)',
          boxShadow: '0 0 60px hsla(195, 92%, 50%, 0.2), inset 0 1px 0 hsla(255, 255, 255, 0.1)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Elite gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        <div 
          className="relative z-10"
          style={{
            '--fc-bg-event-color': 'hsla(195, 92%, 50%, 0.25)',
            '--fc-border-color': 'hsla(195, 92%, 50%, 0.2)',
            '--fc-button-text-color': 'hsl(213, 31%, 91%)',
            '--fc-button-bg-color': 'hsla(217, 32%, 17%, 0.15)',
            '--fc-button-border-color': 'hsla(195, 92%, 50%, 0.2)',
            '--fc-button-hover-bg-color': 'hsla(183, 100%, 67%, 0.8)',
            '--fc-button-hover-border-color': 'hsl(183, 100%, 67%)',
            '--fc-button-active-bg-color': 'hsla(195, 92%, 50%, 0.9)',
            '--fc-button-active-border-color': 'hsl(195, 92%, 50%)',
            '--fc-page-bg-color': 'transparent',
            '--fc-neutral-bg-color': 'hsla(217, 32%, 17%, 0.08)',
            '--fc-neutral-text-color': 'hsl(213, 31%, 91%)',
            '--fc-list-event-hover-bg-color': 'hsla(195, 92%, 50%, 0.15)',
            '--fc-today-bg-color': 'hsla(195, 92%, 50%, 0.08)',
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
            eventClassNames="elite-calendar-event force-platform-event"
            dayHeaderClassNames="elite-day-header force-platform-header"
            slotLabelClassNames="elite-slot-label"
            nowIndicatorClassNames="elite-now-indicator"
            moreLinkClassNames="elite-more-link"
            eventMouseEnter={(info) => {
              info.el.style.transform = 'translateY(-1px)';
              info.el.style.boxShadow = '0 8px 25px hsla(195, 92%, 50%, 0.4)';
              info.el.style.zIndex = '100';
            }}
            eventMouseLeave={(info) => {
              info.el.style.transform = 'translateY(0)';
              info.el.style.boxShadow = 'none';
              info.el.style.zIndex = '1';
            }}
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
                    <Badge 
                      className="border-0 font-semibold"
                      style={{ 
                        background: selectedEvent.extendedProps.styleData?.background || selectedEvent.backgroundColor,
                        color: selectedEvent.extendedProps.styleData?.text || 'hsl(213, 31%, 91%)'
                      }}
                    >
                      {getEventIcon(selectedEvent.extendedProps.booking?.status)} {selectedEvent.extendedProps.booking?.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline" className="glass-input border-accent/30 text-accent">
                      {selectedEvent.extendedProps.category?.toUpperCase() || 'STANDARD'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge 
                      variant={selectedEvent.extendedProps.priority === 'high' ? 'destructive' : selectedEvent.extendedProps.priority === 'medium' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {selectedEvent.extendedProps.priority || 'medium'}
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