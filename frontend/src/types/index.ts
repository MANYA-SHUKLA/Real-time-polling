export interface User {
  _id: string
  name: string
  email: string
  createdAt: string
}

export interface AuthUser extends User {
  token: string
  isVerified?: boolean
}

export interface PollOption {
  _id: string
  text: string
  poll: string
  votes?: number
  createdAt: string
  updatedAt: string
}

export interface Poll {
  _id: string
  question: string
  options: PollOption[]
  creator: User
  isPublished: boolean
  expiresAt?: string
  allowVotingAfterExpiry: boolean
  showResultsAfterExpiry: boolean
  autoArchive: boolean
  totalVotes: number
  userVoted?: boolean
  userVoteOption?: string | null
  status: 'active' | 'expired' | 'draft'
  timeRemaining?: string
  isExpired: boolean
  canVote: boolean
  canViewResults: boolean
  createdAt: string
  updatedAt: string
}

export interface CreatePollData {
  question: string
  options: string[]
  isPublished?: boolean
  expiresAt?: string
  allowVotingAfterExpiry?: boolean
  showResultsAfterExpiry?: boolean
  autoArchive?: boolean
}
export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
}

export interface WebSocketMessage {
  type: 'subscribe' | 'vote_update' | 'poll_status_update'
  pollId?: string
  voteCounts?: Record<string, number>
  totalVotes?: number
  isPublished?: boolean
}