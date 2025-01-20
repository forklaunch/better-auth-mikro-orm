export interface UserInput {
  email: string
  name: string
}

export interface SessionInput {
  token: string
  userId: string
  expiresAt: Date
}
