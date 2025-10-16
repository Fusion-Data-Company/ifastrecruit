import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import iFastRecruitLogo from "@assets/D3A79AEA-5F31-45A5-90D2-AD2878D4A934_1760646767765.png";

export default function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: "fas fa-chart-line" },
    { path: "/candidates", label: "Candidates", icon: "fas fa-users" },
    { path: "/interviews", label: "Interviews", icon: "fas fa-calendar-alt" },
    { path: "/airtop", label: "Airtop Integration", icon: "fas fa-desktop" },
    { path: "/elevenlabs", label: "ElevenLabs Data", icon: "fas fa-headphones" },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost" 
        size="sm"
        className="md:hidden fixed top-4 left-4 z-50 glass-panel p-2"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="mobile-menu-toggle"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'} text-foreground`}></i>
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ x: isOpen ? 0 : 0 }}
        className={`w-64 fixed left-0 top-0 h-full glass-panel border-r z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-0 md:translate-x-0'
        }`}
      >
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8">
          <img 
            src={iFastRecruitLogo} 
            alt="iFast Recruit Logo" 
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.path || (item.path === "/" && location === "/dashboard");
            
            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer micro-animation ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`nav-${item.path.slice(1) || "dashboard"}`}
                >
                  <i className={`${item.icon} w-5`}></i>
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Voice Agent Status */}
        <div className="mt-8 p-4 glass-panel rounded-lg">
          <h3 className="enterprise-heading text-sm font-semibold mb-3">Voice Agents</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-accent"></div>
                <span className="text-sm">UI Interface</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-ui-status">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-primary"></div>
                <span className="text-sm">Interview</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-interview-status">Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-muted-foreground"></div>
                <span className="text-sm">Onboarding</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="agent-onboarding-status">Idle</span>
            </div>
          </div>
        </div>

        {/* Silent Agent Status */}
        <div className="mt-4 p-4 glass-panel rounded-lg">
          <h3 className="enterprise-heading text-sm font-semibold mb-3">Silent Agents</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { name: "Data Proc", status: "active" },
              { name: "Calendar", status: "active" },
              { name: "Airtop", status: "config" },
              { name: "Analytics", status: "active" },
            ].map((agent, index) => (
              <div key={agent.name} className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${agent.status === "config" ? "bg-orange-500" : index % 2 === 0 ? "bg-accent" : "bg-primary"}`}></div>
                <span data-testid={`silent-agent-${agent.name.toLowerCase().replace(" ", "")}`}>
                  {agent.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </motion.div>
    </>
  );
}
