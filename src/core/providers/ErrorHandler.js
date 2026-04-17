export class ErrorHandler {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseRetryDelay = config.baseRetryDelay ?? 1000;
    this.logger = config.logger || console;
    this.authErrorStatuses = config.authErrorStatuses ?? [401, 403];
    this.rateLimitStatus = config.rateLimitStatus ?? 429;
    this.recoverableStatuses = config.recoverableStatuses ?? [408, 500, 502, 503, 504];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isAuthError(error) {
    return this.authErrorStatuses.includes(error?.status) ||
           error?.message?.includes('auth') ||
           error?.message?.includes('unauthorized');
  }

  isRateLimitError(error) {
    return error?.status === this.rateLimitStatus ||
           error?.message?.includes('rate limit') ||
           error?.message?.includes('too many requests');
  }

  isRecoverableError(error) {
    return this.recoverableStatuses.includes(error?.status) ||
           error?.name === 'NetworkError' ||
           error?.name === 'TimeoutError';
  }

  async retryWithBackoff(callback, attempt = 1) {
    if (attempt > this.maxRetries) {
      throw new Error(`Max retry attempts (${this.maxRetries}) exceeded`);
    }

    const delayMs = this.baseRetryDelay * Math.pow(2, attempt - 1);
    await this.delay(delayMs);

    try {
      return await callback();
    } catch (error) {
      this.logger.warn(`Retry attempt ${attempt} failed:`, error.message);
      return await this.retryWithBackoff(callback, attempt + 1);
    }
  }

  async handleError(error, retryCallback, onRefreshAuth) {
    if (this.isAuthError(error) && onRefreshAuth) {
      const refreshed = await onRefreshAuth();
      if (refreshed && retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRateLimitError(error)) {
      await this.delay(this.baseRetryDelay * 5);
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRecoverableError(error)) {
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    }

    throw error;
  }
}