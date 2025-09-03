import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertCandidateSchema, type InsertCandidate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AddCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const candidateFormSchema = insertCandidateSchema.extend({
  sourceRef: insertCandidateSchema.shape.sourceRef?.optional(),
  pipelineStage: insertCandidateSchema.shape.pipelineStage.default("NEW"),
  score: insertCandidateSchema.shape.score?.optional().default(0),
});

export default function AddCandidateDialog({ open, onOpenChange }: AddCandidateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCandidate>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      sourceRef: "Manual",
      pipelineStage: "NEW",
      score: 0,
      tags: [],
    },
  });

  const createCandidateMutation = useMutation({
    mutationFn: async (data: InsertCandidate) => {
      return await apiRequest("/api/candidates", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Success",
        description: "Candidate added successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add candidate",
        variant: "destructive",
      });
      console.error("Failed to create candidate:", error);
    },
  });

  const onSubmit = (data: InsertCandidate) => {
    createCandidateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Candidate</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John Doe" 
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="john.doe@example.com" 
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+1-555-0123" 
                      className="glass-input"
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pipelineStage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pipeline Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="glass-input">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NEW">New Applications</SelectItem>
                      <SelectItem value="FIRST_INTERVIEW">First Interview</SelectItem>
                      <SelectItem value="TECHNICAL_SCREEN">Technical Screen</SelectItem>
                      <SelectItem value="FINAL_INTERVIEW">Final Interview</SelectItem>
                      <SelectItem value="OFFER">Offer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Manual, LinkedIn, Indeed, etc." 
                      className="glass-input"
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="glass-input"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCandidateMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="submit-candidate"
              >
                {createCandidateMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus mr-2"></i>
                    Add Candidate
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}