import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface KPIData {
  todayApplicants: number;
  todayApplicantsChange: number;
  interviewRate: number;
  interviewRateChange: number;
  bookingRate: number;
  bookingRateChange: number;
  offerRate: number;
  offerRateChange: number;
}

export default function KPIDashboard() {
  const { data: kpis, isLoading } = useQuery<KPIData>({
    queryKey: ["/api/kpis"],
  });

  const kpiCards = [
    {
      title: "Today's Applicants",
      icon: "fas fa-user-plus",
      value: kpis?.todayApplicants || 0,
      change: kpis?.todayApplicantsChange || 0,
      changeLabel: "from yesterday",
      testId: "kpi-applicants",
    },
    {
      title: "Interview Rate",
      icon: "fas fa-video",
      value: `${kpis?.interviewRate || 0}%`,
      change: kpis?.interviewRateChange || 0,
      changeLabel: "this week",
      testId: "kpi-interview-rate",
    },
    {
      title: "Booking Rate",
      icon: "fas fa-calendar-check",
      value: `${kpis?.bookingRate || 0}%`,
      change: kpis?.bookingRateChange || 0,
      changeLabel: "this week",
      testId: "kpi-booking-rate",
    },
    {
      title: "Offer Rate",
      icon: "fas fa-handshake",
      value: `${kpis?.offerRate || 0}%`,
      change: kpis?.offerRateChange || 0,
      changeLabel: "this month",
      testId: "kpi-offer-rate",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-6 mb-8">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i} className="glass-panel p-6 rounded-lg animate-pulse">
            <div className="h-4 bg-muted rounded mb-4"></div>
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {kpiCards.map((kpi, index) => (
        <motion.div
          key={kpi.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: index * 0.05 }}
        >
          <Card className="glass-panel p-6 rounded-lg glow-hover" data-testid={kpi.testId}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="enterprise-heading text-sm font-semibold">{kpi.title}</h3>
              <i className={`${kpi.icon} text-primary`}></i>
            </div>
            <div className="text-3xl font-bold mb-2" data-testid={`${kpi.testId}-value`}>
              {kpi.value}
            </div>
            <div className={`text-sm ${kpi.change >= 0 ? "text-accent" : "text-destructive"}`}>
              {kpi.change >= 0 ? "+" : ""}{kpi.change}% {kpi.changeLabel}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
