export type AuthUser = {
  id: number
  name: string
  email: string
  email_verified_at: string | null
}

export type SharedProps = {
  auth: {
    user: AuthUser
    permissions: string[]
  }
}
