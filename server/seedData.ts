import { db } from "./db";
import { 
  candidates, 
  interviews, 
  bookings, 
  campaigns,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertCampaign
} from "@shared/schema";

export async function seedDemoData() {
  try {
    console.log("🌱 Seeding demo data...");

    // Create demo campaigns first
    const campaignData: InsertCampaign[] = [
      {
        name: "Senior Software Engineer - Remote",
        description: "Looking for experienced full-stack developers",
        status: "ACTIVE",
        jobTitle: "Senior Software Engineer",
        requirements: ["5+ years experience", "React/Node.js", "Remote work"],
        budget: 120000,
        source: "INDEED"
      },
      {
        name: "Product Manager - SaaS",
        description: "Product management role for B2B SaaS platform",
        status: "ACTIVE", 
        jobTitle: "Product Manager",
        requirements: ["3+ years PM experience", "B2B SaaS", "Agile/Scrum"],
        budget: 95000,
        source: "APIFY"
      }
    ];

    const insertedCampaigns = await db.insert(campaigns).values(campaignData).returning();
    const [campaign1, campaign2] = insertedCampaigns;

    // Create comprehensive demo candidates with varied pipeline stages
    const candidateData: InsertCandidate[] = [
      {
        name: "Sarah Chen",
        email: "sarah.chen@email.com",
        phone: "+1-555-0123",
        pipelineStage: "NEW",
        source: "Indeed",
        resumeUrl: "/objects/uploads/sarah_chen_resume.pdf",
        skills: ["React", "TypeScript", "Node.js", "AWS"],
        experience: 6,
        notes: "Strong technical background, recently interviewed at Meta",
        campaignId: campaign1.id
      },
      {
        name: "Marcus Johnson",
        email: "marcus.j@email.com", 
        phone: "+1-555-0124",
        pipelineStage: "FIRST_INTERVIEW",
        source: "LinkedIn",
        resumeUrl: "/objects/uploads/marcus_johnson_resume.pdf",
        skills: ["Python", "Django", "PostgreSQL", "Docker"],
        experience: 4,
        notes: "Completed initial phone screening - very promising",
        campaignId: campaign1.id
      },
      {
        name: "Emily Rodriguez",
        email: "emily.rodriguez@email.com",
        phone: "+1-555-0125", 
        pipelineStage: "FINAL_INTERVIEW",
        source: "Indeed",
        resumeUrl: "/objects/uploads/emily_rodriguez_resume.pdf",
        skills: ["Vue.js", "Express", "MongoDB", "Kubernetes"],
        experience: 5,
        notes: "Excellent technical interview performance, cultural fit",
        campaignId: campaign1.id
      },
      {
        name: "David Park",
        email: "david.park@email.com",
        phone: "+1-555-0126",
        pipelineStage: "OFFER", 
        source: "Referral",
        resumeUrl: "/objects/uploads/david_park_resume.pdf",
        skills: ["React", "Node.js", "GraphQL", "Terraform"],
        experience: 7,
        notes: "Offer extended - $125k base + equity, awaiting response",
        campaignId: campaign1.id
      },
      {
        name: "Lisa Wang",
        email: "lisa.wang@email.com",
        phone: "+1-555-0127",
        pipelineStage: "HIRED",
        source: "Indeed", 
        resumeUrl: "/objects/uploads/lisa_wang_resume.pdf",
        skills: ["Angular", "Java", "Spring Boot", "Azure"],
        experience: 8,
        notes: "Accepted offer! Start date: Next Monday. Senior dev role.",
        campaignId: campaign1.id
      },
      {
        name: "James Smith",
        email: "james.smith@email.com", 
        phone: "+1-555-0128",
        pipelineStage: "REJECTED",
        source: "Indeed",
        resumeUrl: "/objects/uploads/james_smith_resume.pdf", 
        skills: ["PHP", "Laravel", "MySQL"],
        experience: 3,
        notes: "Technical skills not quite at required level for senior role",
        campaignId: campaign1.id
      },
      {
        name: "Amanda Foster",
        email: "amanda.foster@email.com",
        phone: "+1-555-0129",
        pipelineStage: "FIRST_INTERVIEW", 
        source: "Apify",
        resumeUrl: "/objects/uploads/amanda_foster_resume.pdf",
        skills: ["Product Strategy", "Roadmapping", "User Research", "Analytics"],
        experience: 5,
        notes: "PM candidate - strong background in B2B SaaS platforms",
        campaignId: campaign2.id
      },
      {
        name: "Robert Kim",
        email: "robert.kim@email.com",
        phone: "+1-555-0130", 
        pipelineStage: "FINAL_INTERVIEW",
        source: "LinkedIn",
        resumeUrl: "/objects/uploads/robert_kim_resume.pdf",
        skills: ["Agile", "Scrum", "Jira", "Confluence", "SQL"],
        experience: 4,
        notes: "Great interview - understands our product vision well",
        campaignId: campaign2.id
      },
      {
        name: "Jennifer Lee",
        email: "jennifer.lee@email.com",
        phone: "+1-555-0131",
        pipelineStage: "NEW",
        source: "Indeed",
        resumeUrl: "/objects/uploads/jennifer_lee_resume.pdf", 
        skills: ["React Native", "iOS", "Android", "Firebase"],
        experience: 4,
        notes: "Mobile development focus - could be good for upcoming mobile project",
        campaignId: campaign1.id
      },
      {
        name: "Michael Chang",
        email: "michael.chang@email.com",
        phone: "+1-555-0132",
        pipelineStage: "FIRST_INTERVIEW",
        source: "Referral",
        resumeUrl: "/objects/uploads/michael_chang_resume.pdf",
        skills: ["DevOps", "AWS", "Terraform", "Jenkins", "Docker"],
        experience: 6,
        notes: "DevOps engineer - could help with infrastructure scaling",
        campaignId: campaign1.id
      },
      {
        name: "Ashley Thompson",
        email: "ashley.thompson@email.com", 
        phone: "+1-555-0133",
        pipelineStage: "OFFER",
        source: "LinkedIn",
        resumeUrl: "/objects/uploads/ashley_thompson_resume.pdf",
        skills: ["Product Analytics", "A/B Testing", "Growth", "Mixpanel"],
        experience: 3,
        notes: "Product Manager offer extended - $90k + benefits package",
        campaignId: campaign2.id
      },
      {
        name: "Daniel Wilson", 
        email: "daniel.wilson@email.com",
        phone: "+1-555-0134",
        pipelineStage: "FINAL_INTERVIEW",
        source: "Indeed",
        resumeUrl: "/objects/uploads/daniel_wilson_resume.pdf",
        skills: ["Full Stack", "React", "Python", "FastAPI", "PostgreSQL"],
        experience: 5,
        notes: "Solid full-stack developer, good cultural fit, team lead potential",
        campaignId: campaign1.id
      }
    ];

    const insertedCandidates = await db.insert(candidates).values(candidateData).returning();

    // Create interview records
    const interviewData: InsertInterview[] = [
      {
        candidateId: insertedCandidates[2].id, // Emily Rodriguez
        interviewerName: "Tech Lead",
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        type: "TECHNICAL",
        status: "SCHEDULED",
        notes: "Technical deep-dive - system design and coding"
      },
      {
        candidateId: insertedCandidates[3].id, // David Park  
        interviewerName: "CTO",
        scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        type: "FINAL",
        status: "COMPLETED",
        notes: "Final interview completed - strong performance, cultural fit confirmed"
      },
      {
        candidateId: insertedCandidates[7].id, // Robert Kim
        interviewerName: "Product Director", 
        scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        type: "BEHAVIORAL",
        status: "COMPLETED",
        notes: "Great discussion about product strategy and team collaboration"
      },
      {
        candidateId: insertedCandidates[11].id, // Daniel Wilson
        interviewerName: "Engineering Manager",
        scheduledAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        type: "TECHNICAL", 
        status: "SCHEDULED",
        notes: "Full-stack assessment and architecture discussion"
      }
    ];

    await db.insert(interviews).values(interviewData).returning();

    // Create booking records for scheduled interviews
    const bookingData: InsertBooking[] = [
      {
        candidateId: insertedCandidates[2].id, // Emily Rodriguez
        startTs: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // 2 days from now at 9 AM
        endTs: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 1 hour later
        status: "CONFIRMED",
        location: "Video Call - Zoom",
        notes: "Technical interview - system design focus"
      },
      {
        candidateId: insertedCandidates[11].id, // Daniel Wilson
        startTs: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // Tomorrow at 2 PM  
        endTs: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 15.5 * 60 * 60 * 1000), // 1.5 hours later
        status: "CONFIRMED",
        location: "Office Conference Room A",
        notes: "In-person technical interview and team meet"
      },
      {
        candidateId: insertedCandidates[1].id, // Marcus Johnson
        startTs: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // 3 days from now at 11 AM
        endTs: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), // 1 hour later
        status: "PENDING", 
        location: "Video Call - Google Meet",
        notes: "First technical screening call"
      },
      {
        candidateId: insertedCandidates[9].id, // Michael Chang
        startTs: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 4 days from now at 10 AM
        endTs: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 11.5 * 60 * 60 * 1000), // 1.5 hours later
        status: "CONFIRMED",
        location: "Video Call - Teams",
        notes: "DevOps technical assessment and culture fit discussion"
      },
      {
        candidateId: insertedCandidates[6].id, // Amanda Foster
        startTs: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000), // 5 days from now at 1 PM
        endTs: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 1 hour later
        status: "CONFIRMED",
        location: "Video Call - Zoom",
        notes: "Product management case study and portfolio review"
      }
    ];

    await db.insert(bookings).values(bookingData).returning();

    console.log("✅ Demo data seeded successfully!");
    console.log(`   - ${candidateData.length} candidates across all pipeline stages`);
    console.log(`   - ${interviewData.length} interview records`); 
    console.log(`   - ${bookingData.length} scheduled interviews`);
    console.log(`   - ${campaignData.length} active campaigns`);

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}