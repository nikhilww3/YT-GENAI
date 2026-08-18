// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry configuration
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TRANSIENT_STATUS_CODES = [429, 500, 502, 503];

// Transient error checking for Gemini
function isTransientGeminiError(err) {
  return TRANSIENT_STATUS_CODES.some(code => String(err.message).includes(`"code":${code}`));
}

// Transient error checking for OpenAI-compatible APIs
function isTransientOpenAICompatibleError(err) {
  return TRANSIENT_STATUS_CODES.includes(err.status);
}

// Generic retry helper with exponential backoff
async function withRetry(operation, isTransientErrorFn, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (!isTransientErrorFn(err) || attempt === MAX_ATTEMPTS) {
        break;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`${label} attempt ${attempt} of ${MAX_ATTEMPTS} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = {
  sleep,
  MAX_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  TRANSIENT_STATUS_CODES,
  isTransientGeminiError,
  isTransientOpenAICompatibleError,
  withRetry
};