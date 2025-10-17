export const mockUsers = {
  regular: {
    id: 'user-1',
    email: 'user1@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isAdmin: false,
    hasCompletedOnboarding: true,
    tier: 'FL_LICENSED',
    createdAt: new Date('2024-01-01')
  },
  admin: {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    hasCompletedOnboarding: true,
    tier: 'MULTI_STATE',
    createdAt: new Date('2024-01-01')
  },
  newUser: {
    id: 'new-user-1',
    email: 'newuser@example.com',
    firstName: 'New',
    lastName: 'User',
    isAdmin: false,
    hasCompletedOnboarding: false,
    tier: 'NON_LICENSED',
    createdAt: new Date('2024-01-15')
  }
};

export const mockChannels = {
  general: {
    id: 'channel-1',
    name: 'general',
    description: 'General discussion',
    tier: 'NON_LICENSED',
    isActive: true,
    createdBy: mockUsers.admin.id,
    createdAt: new Date('2024-01-01')
  },
  florida: {
    id: 'channel-2',
    name: 'florida-agents',
    description: 'Florida licensed agents',
    tier: 'FL_LICENSED',
    isActive: true,
    createdBy: mockUsers.admin.id,
    createdAt: new Date('2024-01-02')
  },
  multistate: {
    id: 'channel-3',
    name: 'multi-state',
    description: 'Multi-state licensed agents',
    tier: 'MULTI_STATE',
    isActive: true,
    createdBy: mockUsers.admin.id,
    createdAt: new Date('2024-01-03')
  }
};

export const mockMessages = {
  message1: {
    id: 'msg-1',
    channelId: mockChannels.general.id,
    userId: mockUsers.regular.id,
    content: 'Hello everyone!',
    type: 'text',
    createdAt: new Date('2024-01-10T10:00:00')
  },
  message2: {
    id: 'msg-2',
    channelId: mockChannels.general.id,
    userId: mockUsers.admin.id,
    content: 'Welcome to the channel!',
    type: 'text',
    createdAt: new Date('2024-01-10T10:05:00')
  },
  systemMessage: {
    id: 'msg-3',
    channelId: mockChannels.general.id,
    userId: 'system',
    content: 'User joined the channel',
    type: 'system',
    createdAt: new Date('2024-01-10T09:00:00')
  }
};

export const mockCandidates = {
  john: {
    id: 'candidate-1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '555-1234',
    pipelineStage: 'NEW',
    score: 85,
    tags: ['experienced', 'florida'],
    resumeUrl: 'https://example.com/resume1.pdf',
    createdAt: new Date('2024-01-05')
  },
  jane: {
    id: 'candidate-2',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '555-5678',
    pipelineStage: 'FIRST_INTERVIEW',
    score: 92,
    tags: ['senior', 'multi-state'],
    resumeUrl: 'https://example.com/resume2.pdf',
    createdAt: new Date('2024-01-06')
  },
  bob: {
    id: 'candidate-3',
    name: 'Bob Wilson',
    email: 'bob.wilson@example.com',
    phone: '555-9012',
    pipelineStage: 'TECHNICAL_SCREEN',
    score: 78,
    tags: ['junior'],
    createdAt: new Date('2024-01-07')
  }
};

export const mockWorkflows = {
  onboarding: {
    id: 'workflow-1',
    name: 'New Candidate Onboarding',
    description: 'Automated onboarding for new candidates',
    status: 'active',
    triggerType: 'event',
    triggerConfig: {
      event: 'candidate_created'
    },
    actions: [
      {
        type: 'send_email',
        config: {
          templateId: 'welcome',
          to: '{{candidate.email}}'
        }
      },
      {
        type: 'create_task',
        config: {
          title: 'Review candidate profile',
          assignTo: 'hr-team'
        }
      }
    ],
    createdBy: mockUsers.admin.id,
    createdAt: new Date('2024-01-01')
  },
  interviewReminder: {
    id: 'workflow-2',
    name: 'Interview Reminder',
    description: 'Send reminder before interview',
    status: 'active',
    triggerType: 'schedule',
    triggerConfig: {
      schedule: '0 9 * * *' // Daily at 9 AM
    },
    actions: [
      {
        type: 'condition',
        config: {
          condition: 'interview.date == today + 1'
        }
      },
      {
        type: 'send_email',
        config: {
          templateId: 'interview_reminder',
          to: '{{candidate.email}}'
        }
      }
    ],
    createdBy: mockUsers.admin.id,
    createdAt: new Date('2024-01-02')
  }
};

export const mockElevenLabsConversations = {
  conversation1: {
    conversation_id: 'conv-1',
    agent_id: 'agent-test',
    status: 'completed',
    created_at: '2024-01-10T10:00:00Z',
    ended_at: '2024-01-10T10:30:00Z',
    metadata: {
      call_successful: 'yes',
      duration_seconds: 1800
    },
    transcript: {
      messages: [
        {
          role: 'agent',
          content: 'Hello, can you tell me about your experience?',
          timestamp: '2024-01-10T10:00:05Z'
        },
        {
          role: 'user',
          content: 'I have 5 years of experience in sales.',
          timestamp: '2024-01-10T10:00:15Z'
        }
      ]
    }
  },
  conversation2: {
    conversation_id: 'conv-2',
    agent_id: 'agent-test',
    status: 'failed',
    created_at: '2024-01-10T11:00:00Z',
    error: 'Connection timeout',
    metadata: {
      call_successful: 'no'
    }
  }
};

export const mockCalls = {
  activeCall: {
    id: 'call-1',
    type: 'voice',
    status: 'active',
    roomId: 'room-1',
    initiatorId: mockUsers.regular.id,
    startedAt: new Date('2024-01-10T10:00:00'),
    metadata: {
      channelId: mockChannels.general.id
    }
  },
  endedCall: {
    id: 'call-2',
    type: 'video',
    status: 'ended',
    roomId: 'room-2',
    initiatorId: mockUsers.admin.id,
    startedAt: new Date('2024-01-10T09:00:00'),
    endedAt: new Date('2024-01-10T09:30:00'),
    duration: 1800,
    metadata: {
      recordingUrl: 'https://example.com/recording.mp4'
    }
  }
};

export const mockNotifications = {
  unread: {
    id: 'notif-1',
    userId: mockUsers.regular.id,
    type: 'message',
    title: 'New message',
    message: 'You have a new message in #general',
    status: 'unread',
    metadata: {
      channelId: mockChannels.general.id,
      messageId: mockMessages.message2.id
    },
    createdAt: new Date('2024-01-10T10:05:00')
  },
  read: {
    id: 'notif-2',
    userId: mockUsers.regular.id,
    type: 'mention',
    title: 'You were mentioned',
    message: '@john mentioned you in #florida-agents',
    status: 'read',
    readAt: new Date('2024-01-10T10:10:00'),
    metadata: {
      channelId: mockChannels.florida.id
    },
    createdAt: new Date('2024-01-10T10:00:00')
  }
};

export const mockApiResponses = {
  success: {
    status: 200,
    data: { success: true }
  },
  created: {
    status: 201,
    data: { id: 'new-id', success: true }
  },
  badRequest: {
    status: 400,
    error: 'Bad Request',
    message: 'Invalid input data'
  },
  unauthorized: {
    status: 401,
    error: 'Unauthorized',
    message: 'Authentication required'
  },
  forbidden: {
    status: 403,
    error: 'Forbidden',
    message: 'Insufficient permissions'
  },
  notFound: {
    status: 404,
    error: 'Not Found',
    message: 'Resource not found'
  },
  serverError: {
    status: 500,
    error: 'Internal Server Error',
    message: 'Something went wrong'
  }
};