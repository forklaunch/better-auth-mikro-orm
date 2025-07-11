export interface AddressInput {
  street: string
  city: string
}

export interface UserInput {
  email: string
  name: string
  address?: AddressInput
}

export interface SessionInput {
  token: string
  userId: string
  expiresAt: Date
}
