import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useMCPClient } from "@/lib/mcp-client";
import type { Candidate } from "@shared/schema";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  candidates: Candidate[];
}

function DraggableCandidate({ candidate }: { candidate: Candidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      className={`candidate-card p-3 rounded-lg border border-border bg-card hover:shadow-md transition-all duration-200 cursor-move ${isDragging ? 'opacity-50' : ''}`}
      data-testid={`pipeline-candidate-${candidate.id}`}
    >
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
          {candidate.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm truncate block" data-testid={`pipeline-candidate-name-${candidate.id}`}>
            {candidate.name}
          </span>
          <div className="text-xs text-muted-foreground truncate">
            {candidate.email}
          </div>
        </div>
      </div>
      
      {/* Resume Link */}
      {candidate.resumeUrl && (
        <div className="text-xs text-blue-500 mb-2 flex items-center">
          <i className="fas fa-file-pdf mr-1"></i>
          <span>Resume Available</span>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <Badge className="text-xs bg-secondary/50">
          {candidate.sourceRef || "Manual"}
        </Badge>
        <div className="flex items-center space-x-1">
          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300"
              style={{ width: `${candidate.score || 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-primary">{candidate.score || 0}%</span>
        </div>
      </div>
    </motion.div>
  );
}

function DroppableColumn({ stage }: { stage: PipelineStage }) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="pipeline-column rounded-lg p-4 bg-muted/30"
      data-testid={`pipeline-stage-${stage.id}`}
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-sm text-foreground">{stage.name}</h4>
        <Badge className={`${stage.color} text-xs border-0`} data-testid={`stage-count-${stage.id}`}>
          {stage.candidates?.length || 0}
        </Badge>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`min-h-[400px] space-y-3 transition-colors duration-200 ${
          isOver ? 'bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg p-2' : ''
        }`}
        data-testid={`droppable-${stage.id}`}
      >
        <AnimatePresence>
          {(stage.candidates || []).map((candidate) => (
            <DraggableCandidate key={candidate.id} candidate={candidate} />
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {(stage.candidates?.length || 0) === 0 && (
          <div className="h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <i className="fas fa-inbox text-2xl mb-2"></i>
              <p className="text-sm">No candidates</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PipelineBoard() {
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const queryClient = useQueryClient();
  const { callTool } = useMCPClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: candidates = [], isLoading, error } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    queryFn: async () => {
      const response = await fetch('/api/candidates');
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      return response.json();
    },
  });


  const updateCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, newStage }: { candidateId: string; newStage: string }) => {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pipelineStage: newStage }),
      });
      if (!response.ok) throw new Error('Failed to update candidate stage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
    },
  });

  const pipelineStages: PipelineStage[] = [
    {
      id: "NEW",
      name: "New Applications",
      color: "bg-blue-500/20 text-blue-700",
      candidates: candidates?.filter(c => c.pipelineStage === "NEW") || [],
    },
    {
      id: "FIRST_INTERVIEW",
      name: "First Interview",
      color: "bg-purple-500/20 text-purple-700",
      candidates: candidates?.filter(c => c.pipelineStage === "FIRST_INTERVIEW") || [],
    },
    {
      id: "TECHNICAL_SCREEN",
      name: "Technical Screen",
      color: "bg-orange-500/20 text-orange-700",
      candidates: candidates?.filter(c => c.pipelineStage === "TECHNICAL_SCREEN") || [],
    },
    {
      id: "FINAL_INTERVIEW",
      name: "Final Interview",
      color: "bg-green-500/20 text-green-700",
      candidates: candidates?.filter(c => c.pipelineStage === "FINAL_INTERVIEW") || [],
    },
    {
      id: "OFFER",
      name: "Offer Extended",
      color: "bg-teal-500/20 text-teal-700",
      candidates: candidates?.filter(c => c.pipelineStage === "OFFER") || [],
    },
  ];

  const handleDragStart = (event: DragStartEvent) => {
    const candidate = candidates?.find(c => c.id === event.active.id);
    setActiveCandidate(candidate || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCandidate(null);

    if (!over || active.id === over.id) return;

    const candidateId = active.id as string;
    const newStage = over.id as string;

    updateCandidateMutation.mutate({ candidateId, newStage });
  };

  if (isLoading) {
    return (
      <Card className="glass-panel rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-48 mb-6"></div>
          <div className="grid grid-cols-5 gap-6">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="enterprise-heading text-lg font-semibold">Candidate Pipeline</h3>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <i className="fas fa-info-circle"></i>
          <span>Drag candidates between stages to update their status</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-6" data-testid="pipeline-board">
          {pipelineStages.map((stage) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: 0.05 * pipelineStages.indexOf(stage) }}
              className="pipeline-column rounded-lg p-4"
              data-testid={`pipeline-stage-${stage.id}`}
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm">{stage.name}</h4>
                <Badge className={`${stage.color} text-xs`} data-testid={`stage-count-${stage.id}`}>
                  {stage.candidates?.length || 0}
                </Badge>
              </div>

              {/* Droppable Area */}
              <div
                className="min-h-[400px] space-y-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                data-testid={`droppable-${stage.id}`}
              >
                <AnimatePresence>
                  {(stage.candidates || []).map((candidate) => (
                    <motion.div
                      key={candidate.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ y: -2 }}
                      whileDrag={{ scale: 1.05, rotate: 2 }}
                      className="candidate-card p-3 rounded-lg border border-border cursor-move"
                      draggable
                      onDragStart={(e) => {
                        const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
                        dragEvent.dataTransfer.setData("text/plain", candidate.id);
                        setActiveCandidate(candidate);
                      }}
                      data-testid={`pipeline-candidate-${candidate.id}`}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs">
                          {candidate.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-sm" data-testid={`pipeline-candidate-name-${candidate.id}`}>
                          {candidate.name}
                        </span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-2">
                        {candidate.email}
                      </div>
                      
                      {/* Resume Link */}
                      {candidate.resumeUrl && (
                        <div className="text-xs text-blue-500 mb-2">
                          <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            <i className="fas fa-file-pdf mr-1"></i>
                            Resume
                          </a>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <Badge className="text-xs bg-primary/20 text-primary">
                          {candidate.sourceRef || "Manual"}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-accent rounded-full transition-all duration-300"
                              style={{ width: `${candidate.score || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-accent">{candidate.score || 0}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty State */}
                {(stage.candidates?.length || 0) === 0 && (
                  <div className="h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <i className="fas fa-inbox text-2xl mb-2"></i>
                      <p className="text-sm">No candidates</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <DragOverlay>
          {activeCandidate && (
            <motion.div
              initial={{ rotate: 5 }}
              animate={{ rotate: 0 }}
              className="candidate-card p-3 rounded-lg border border-border bg-card shadow-lg"
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs">
                  {activeCandidate.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span className="font-medium text-sm">{activeCandidate.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{activeCandidate.email}</div>
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Pipeline Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          Drag candidates between stages to update their pipeline status
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="glass-input glow-hover"
            data-testid="refresh-pipeline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/candidates"] })}
          >
            <i className="fas fa-sync-alt mr-2"></i>
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="glass-input glow-hover"
            data-testid="bulk-actions"
          >
            <i className="fas fa-tasks mr-2"></i>
            Bulk Actions
          </Button>
        </div>
      </div>
    </Card>
  );
}
