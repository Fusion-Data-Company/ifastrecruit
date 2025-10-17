export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'Test123!',
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true
  },
  regularUser: {
    email: 'user@test.com',
    password: 'Test123!',
    firstName: 'Regular',
    lastName: 'User',
    isAdmin: false
  },
  newUser: {
    email: 'newuser@test.com',
    password: 'Test123!',
    firstName: 'New',
    lastName: 'User',
    isAdmin: false
  }
};

export const testChannels = [
  {
    name: 'general',
    description: 'General discussion',
    tier: 'NON_LICENSED',
    isPublic: true
  },
  {
    name: 'florida-agents',
    description: 'Florida licensed agents only',
    tier: 'FL_LICENSED',
    isPublic: true
  },
  {
    name: 'multi-state',
    description: 'Multi-state licensed agents',
    tier: 'MULTI_STATE',
    isPublic: true
  }
];

export const testCandidates = [
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '555-0001',
    pipelineStage: 'NEW',
    score: 85,
    tags: ['experienced', 'florida'],
    notes: 'Strong background in sales'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '555-0002',
    pipelineStage: 'FIRST_INTERVIEW',
    score: 92,
    tags: ['senior', 'multi-state'],
    notes: 'Excellent communication skills'
  },
  {
    name: 'Bob Wilson',
    email: 'bob.wilson@example.com',
    phone: '555-0003',
    pipelineStage: 'TECHNICAL_SCREEN',
    score: 78,
    tags: ['junior'],
    notes: 'Eager to learn'
  }
];

export const testWorkflows = [
  {
    name: 'Candidate Welcome',
    description: 'Send welcome email to new candidates',
    triggerType: 'event',
    triggerEvent: 'candidate_created',
    actions: [
      {
        type: 'send_email',
        templateId: 'welcome',
        to: '{{candidate.email}}'
      }
    ]
  },
  {
    name: 'Interview Reminder',
    description: 'Send reminder 24 hours before interview',
    triggerType: 'schedule',
    schedule: '0 9 * * *',
    actions: [
      {
        type: 'condition',
        condition: 'interview.date == tomorrow'
      },
      {
        type: 'send_email',
        templateId: 'interview_reminder',
        to: '{{candidate.email}}'
      }
    ]
  }
];

export const testMessages = [
  'Hello everyone! 👋',
  'Has anyone completed the onboarding?',
  'The new feature is amazing!',
  'Can someone help me with this issue?',
  'Meeting at 3 PM today, don\'t forget!',
  'Great work on the project everyone!'
];

export const sampleFiles = {
  resume: {
    name: 'sample-resume.pdf',
    content: Buffer.from('Sample resume content'),
    type: 'application/pdf'
  },
  document: {
    name: 'test-document.pdf',
    content: Buffer.from('Test document content'),
    type: 'application/pdf'
  },
  image: {
    name: 'test-image.png',
    content: Buffer.from('PNG image data'),
    type: 'image/png'
  }
};