import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { MainUIAgent } from "@/components/ElevenLabsWidgets";
import KPIDashboard from "@/components/KPIDashboard";
import DataGrid from "@/components/DataGrid";
import PipelineBoard from "@/components/PipelineBoard";
import ApifyStudio from "@/components/ApifyStudio";
import { motion } from "framer-motion";

type TabType = "grid" | "pipeline" | "apify" | "calendar";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("grid");

  const renderTabContent = () => {
    switch (activeTab) {
      case "grid":
        return <DataGrid />;
      case "pipeline":
        return <PipelineBoard />;
      case "apify":
        return <ApifyStudio />;
      case "calendar":
        return (
          <div className="glass-panel rounded-lg p-6 text-center">
            <i className="fas fa-calendar-alt text-4xl text-primary mb-4"></i>
            <p className="text-muted-foreground">Calendar integration coming soon</p>
          </div>
        );
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
