/**
 * Centralized logging utility for MediaSite
 * Replaces scattered console.log statements with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Format log message with context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Send logs to external service in production
   */
  private sendToExternalService(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.isProduction) return;

    // TODO: Integrate with logging service (e.g., DataDog, LogRocket, Sentry)
    // Example:
    // if (level === 'error' && error) {
    //   Sentry.captureException(error, { contexts: { custom: context } });
    // }
  }

  /**
   * Debug-level logging (only in development)
   */
  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Info-level logging
   */
  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, context));
    }
    this.sendToExternalService('info', message, context);
  }

  /**
   * Warning-level logging
   */
  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context));
    this.sendToExternalService('warn', message, context);
  }

  /**
   * Error-level logging
   */
  error(message: string, error?: Error, context?: LogContext) {
    console.error(this.formatMessage('error', message, context));
    if (error) {
      console.error(error);
    }
    this.sendToExternalService('error', message, context, error);
  }

  /**
   * Performance logging
   */
  performance(label: string, duration: number, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(this.formatMessage('info', `⚡ ${label}: ${duration.toFixed(2)}ms`, context));
    }
  }

  /**
   * API request logging
   */
  apiRequest(method: string, path: string, statusCode?: number, duration?: number) {
    const context = { method, path, statusCode, duration };
    if (this.isDevelopment) {
      const emoji = statusCode && statusCode >= 400 ? '❌' : '✅';
      console.log(this.formatMessage('info', `${emoji} ${method} ${path}`, context));
    }
    this.sendToExternalService('info', 'API Request', context);
  }

  /**
   * User action logging (for analytics)
   */
  userAction(action: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(this.formatMessage('info', `👤 User Action: ${action}`, context));
    }
    this.sendToExternalService('info', `User Action: ${action}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports for common patterns
export const logError = (message: string, error?: Error, context?: LogContext) => 
  logger.error(message, error, context);

export const logWarning = (message: string, context?: LogContext) => 
  logger.warn(message, context);

export const logInfo = (message: string, context?: LogContext) => 
  logger.info(message, context);

export const logDebug = (message: string, context?: LogContext) => 
  logger.debug(message, context);

export default logger;
