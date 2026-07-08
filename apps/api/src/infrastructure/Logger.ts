export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  userId?: string
  sessionId?: string
  durationMs?: number
  error?: Error
  metadata?: Record<string, unknown>
}

export class Logger {
  private readonly level: LogLevel

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level
  }

  private log(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
    if (level < this.level) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }

    const formatted = JSON.stringify(entry)

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted)
        break
      case LogLevel.WARN:
        console.warn(formatted)
        break
      case LogLevel.INFO:
        console.log(formatted)
        break
      case LogLevel.DEBUG:
        console.debug(formatted)
        break
    }
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, message, meta)
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, message, meta)
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, message, meta)
  }

  error(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.ERROR, message, meta)
  }
}

const logLevelStr = process.env.LOG_LEVEL
const logLevel: LogLevel = logLevelStr
  ? (LogLevel[logLevelStr.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO)
  : LogLevel.INFO

export const logger = new Logger(logLevel)
