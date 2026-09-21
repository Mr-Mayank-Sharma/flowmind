declare module "smtp-server" {
  import type { Readable } from "node:stream"
  import type { Server } from "node:net"

  export interface SMTPServerSession {
    envelope: {
      mailFrom?: { address: string } | null
      rcptTo?: { address: string }[]
    }
  }

  export interface SMTPServerOptions {
    authOptional?: boolean
    disabledCommands?: string[]
    onData?: (
      stream: Readable,
      session: SMTPServerSession,
      callback: (err?: Error | null) => void
    ) => void
    onAuth?: (
      auth: unknown,
      session: SMTPServerSession,
      callback: (response: unknown) => void
    ) => void
  }

  export class SMTPServer {
    constructor(options?: SMTPServerOptions)
    server: Server
    listen(port: number, host?: string, callback?: () => void): void
    close(callback?: (err?: Error) => void): void
  }
}