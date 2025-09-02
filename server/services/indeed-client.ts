interface IndeedJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  requirements?: string;
  salary?: string;
  type: string;
}

interface IndeedApplication {
  applicationId: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  phone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  appliedAt: string;
  screeningAnswers?: Record<string, any>;
  eeoData?: Record<string, any>;
}

export class IndeedService {
  private apiKey: string | undefined;
  private baseUrl: string = 'https://secure.indeed.com/graphql';
  private isConnected: boolean = false;

  constructor() {
    this.apiKey = process.env.INDEED_API_KEY;
    this.isConnected = !!this.apiKey;
    
    if (!this.isConnected) {
      console.warn('INDEED_API_KEY not provided. Indeed functionality will be limited.');
    }
  }

  private async makeGraphQLRequest(query: string, variables: any = {}) {
    if (!this.isConnected) {
      throw new Error('Indeed client not connected. Please provide INDEED_API_KEY.');
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`Indeed API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Indeed GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('Indeed API request failed:', error);
      throw error;
    }
  }

  async postJob(jobData: IndeedJobData) {
    const mutation = `
      mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) {
          jobId
          status
          createdAt
          applicationUrl
        }
      }
    `;

    const variables = {
      input: {
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        description: jobData.description,
        requirements: jobData.requirements,
        salary: jobData.salary,
        jobType: jobData.type,
        applyType: 'EXTERNAL',
      },
    };

    try {
      const result = await this.makeGraphQLRequest(mutation, variables);
      return result.createJob;
    } catch (error) {
      console.error('Failed to post job to Indeed:', error);
      throw new Error('Failed to post job to Indeed');
    }
  }

  async getJobApplications(jobId: string) {
    const query = `
      query GetJobApplications($jobId: ID!) {
        job(id: $jobId) {
          applications(first: 100) {
            edges {
              node {
                id
                appliedAt
                status
                candidate {
                  name
                  email
                  phone
                  resumeUrl
                  coverLetter
                }
                screeningAnswers {
                  questionText
                  answerText
                }
                eeoData {
                  ethnicity
                  gender
                  veteranStatus
                  disabilityStatus
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(query, { jobId });
      return result.job?.applications?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error('Failed to get job applications:', error);
      throw new Error('Failed to fetch job applications');
    }
  }

  async sendDisposition(applicationId: string, disposition: string, reason?: string) {
    const mutation = `
      mutation UpdateApplicationDisposition($input: UpdateApplicationDispositionInput!) {
        updateApplicationDisposition(input: $input) {
          application {
            id
            status
            dispositionReason
            updatedAt
          }
        }
      }
    `;

    const variables = {
      input: {
        applicationId,
        disposition: disposition.toUpperCase(),
        reason,
      },
    };

    try {
      const result = await this.makeGraphQLRequest(mutation, variables);
      return result.updateApplicationDisposition.application;
    } catch (error) {
      console.error('Failed to send disposition to Indeed:', error);
      throw new Error('Failed to update application disposition');
    }
  }

  async getJobStats(jobId: string) {
    const query = `
      query GetJobStats($jobId: ID!) {
        job(id: $jobId) {
          id
          title
          status
          applicationsCount
          viewsCount
          createdAt
          expiresAt
          applications(first: 1) {
            edges {
              node {
                appliedAt
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(query, { jobId });
      return result.job;
    } catch (error) {
      console.error('Failed to get job stats:', error);
      throw new Error('Failed to fetch job statistics');
    }
  }

  async setupWebhook(webhookUrl: string, events: string[] = ['APPLICATION_CREATED']) {
    const mutation = `
      mutation CreateWebhook($input: CreateWebhookInput!) {
        createWebhook(input: $input) {
          webhook {
            id
            url
            events
            isActive
            createdAt
          }
        }
      }
    `;

    const variables = {
      input: {
        url: webhookUrl,
        events,
        isActive: true,
      },
    };

    try {
      const result = await this.makeGraphQLRequest(mutation, variables);
      return result.createWebhook.webhook;
    } catch (error) {
      console.error('Failed to setup Indeed webhook:', error);
      throw new Error('Failed to setup webhook');
    }
  }

  async validateApplication(applicationData: IndeedApplication): Promise<boolean> {
    // Validate that required fields are present
    const requiredFields = ['applicationId', 'jobId', 'candidateName', 'candidateEmail'];
    
    for (const field of requiredFields) {
      if (!applicationData[field as keyof IndeedApplication]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicationData.candidateEmail)) {
      console.error('Invalid email format:', applicationData.candidateEmail);
      return false;
    }

    return true;
  }

  isApiConnected(): boolean {
    return this.isConnected;
  }

  getWebhookEndpoint(): string {
    const baseUrl = process.env.APP_BASE_URL || 'https://your-app.replit.app';
    return `${baseUrl}/api/indeed/applications`;
  }
}

export const indeedService = new IndeedService();