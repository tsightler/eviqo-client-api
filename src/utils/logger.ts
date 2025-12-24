/**
 * Simple logger utility for Eviqo client
 *
 * Provides logging with timestamps and log levels
 * matching the Python implementation format
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;
  private name: string;

  constructor(name: string, level: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.level = level;
  }

  private formatTime(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // HH:MM:SS format
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.level) {
      return;
    }

    const timestamp = this.formatTime();
    const levelName = LogLevel[level];
    const formattedMessage = `${timestamp} - ${this.name} - ${levelName} - ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Create default logger instance
export const logger = new Logger('evipy', LogLevel.DEBUG);

// Export Logger class for custom instances
export { Logger };
