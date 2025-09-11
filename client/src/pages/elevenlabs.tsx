import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ElevenLabsDataCollection from "@/components/ElevenLabsDataCollection";
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Headphones, Database, Bot, Zap } from 'lucide-react';

export default function ElevenLabsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />
      <main className="md:ml-64 pt-16 p-4 md:p-6">
        <div className="space-y-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="enterprise-heading text-3xl font-bold flex items-center space-x-3">
                  <Headphones className="w-8 h-8 text-primary" />
                  <span>ElevenLabs Integration</span>
                </h1>
                <p className="text-muted-foreground text-lg">
                  Collect and analyze conversational AI agent data from your ElevenLabs agents
                </p>
              </div>
            </div>

            {/* Feature Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="glass-panel">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Data Collection</p>
                      <p className="text-sm text-muted-foreground">
                        Fetch all agent conversations
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Bot className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Agent Analytics</p>
                      <p className="text-sm text-muted-foreground">
                        Analyze performance metrics
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Headphones className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium">Audio Processing</p>
                      <p className="text-sm text-muted-foreground">
                        Access conversation recordings
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium">Real-time Sync</p>
                      <p className="text-sm text-muted-foreground">
                        Import to candidate pipeline
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Main Data Collection Component */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ElevenLabsDataCollection />
          </motion.div>

          {/* Documentation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-panel">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">How it Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <h4 className="font-medium text-primary">Data Collection Process</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start space-x-2">
                        <span className="text-primary">1.</span>
                        <span>Enter your ElevenLabs Agent ID</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-primary">2.</span>
                        <span>Click "Collect Data" to fetch all conversations</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-primary">3.</span>
                        <span>Review conversation details and transcripts</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-primary">4.</span>
                        <span>Access audio recordings when available</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-primary">Available Data</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start space-x-2">
                        <span className="text-green-500">•</span>
                        <span>Complete conversation transcripts</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-green-500">•</span>
                        <span>Audio recordings and metadata</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-green-500">•</span>
                        <span>Conversation timing and duration</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-green-500">•</span>
                        <span>Agent performance analytics</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}