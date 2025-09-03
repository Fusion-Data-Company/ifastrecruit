import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { MainUIAgent } from "@/components/ElevenLabsWidgets";
import KPIDashboard from "@/components/KPIDashboard";
import DataGrid from "@/components/DataGrid";
import PipelineBoard from "@/components/PipelineBoard";
import ApifyStudio from "@/components/ApifyStudio";
import Calendar from "@/components/Calendar";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import WorkflowEngine from "@/components/WorkflowEngine";
import SystemMonitoring from "@/components/SystemMonitoring";
import AuditLogs from "@/components/AuditLogs";
import { motion } from "framer-motion";

type TabType = "grid" | "pipeline" | "apify" | "calendar" | "analytics" | "workflow" | "monitoring" | "audit";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("analytics");

  const renderTabContent = () => {
    switch (activeTab) {
      case "grid":
        return <DataGrid />;
      case "pipeline":
        return <PipelineBoard />;
      case "apify":
        return <ApifyStudio />;
      case "calendar":
        return <Calendar />;
      case "analytics":
        return <AnalyticsDashboard />;
      case "workflow":
        return <WorkflowEngine />;
      case "monitoring":
        return <SystemMonitoring />;
      case "audit":
        return <AuditLogs />;
      default:
        return <DataGrid />;
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="ml-64 flex-1">
        <TopBar />
        
        <div className="p-6">
          <KPIDashboard />

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="flex space-x-1 glass-panel p-1 rounded-lg w-fit">
              {[
                { id: "grid", label: "Data Grid", icon: "fas fa-table" },
                { id: "pipeline", label: "Pipeline", icon: "fas fa-stream" },
                { id: "apify", label: "Apify Studio", icon: "fas fa-robot" },
                { id: "calendar", label: "Calendar", icon: "fas fa-calendar" },
                { id: "analytics", label: "Analytics", icon: "fas fa-chart-bar" },
                { id: "workflow", label: "Automation", icon: "fas fa-robot" },
                { id: "monitoring", label: "Monitoring", icon: "fas fa-server" },
                { id: "audit", label: "Audit Logs", icon: "fas fa-clipboard-list" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-2 rounded-md text-sm font-medium micro-animation ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <i className={`${tab.icon} mr-2`}></i>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderTabContent()}
          </motion.div>
        </div>
      </div>

      <MainUIAgent />
    </div>
  );
}
