const readRequiredEnv = (name, rawValue) => {
  const value = rawValue?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readPositiveIntegerEnv = (name, rawValue) => {
  const value = Number.parseInt(readRequiredEnv(name, rawValue), 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
};

export const AMBASSADOR_BASE_URL = readRequiredEnv(
  'VITE_AMBASSADOR_BASE_URL',
  import.meta.env.VITE_AMBASSADOR_BASE_URL,
).replace(/\/+$/, '');
export const DITTO_API_BASE_URL = `${AMBASSADOR_BASE_URL}/api/2`;
export const DIGITAL_TWIN_CREATE_BASE_URL = `${AMBASSADOR_BASE_URL}/api/digital-twins`;
export const DITTO_POLICY_SUBJECT = readRequiredEnv(
  'VITE_DITTO_POLICY_SUBJECT',
  import.meta.env.VITE_DITTO_POLICY_SUBJECT,
);

export const HOME_POLL_INTERVAL_MS = readPositiveIntegerEnv(
  'VITE_HOME_POLL_INTERVAL_MS', import.meta.env.VITE_HOME_POLL_INTERVAL_MS,
);
export const STATUS_POLL_INTERVAL_MS = readPositiveIntegerEnv(
  'VITE_STATUS_POLL_INTERVAL_MS', import.meta.env.VITE_STATUS_POLL_INTERVAL_MS,
);
export const SEARCH_PAGE_SIZE = readPositiveIntegerEnv(
  'VITE_SEARCH_PAGE_SIZE', import.meta.env.VITE_SEARCH_PAGE_SIZE,
);

export const NEO4J_URI = readRequiredEnv('VITE_NEO4J_URI', import.meta.env.VITE_NEO4J_URI);
export const NEO4J_USER = readRequiredEnv('VITE_NEO4J_USER', import.meta.env.VITE_NEO4J_USER);
export const NEO4J_PASSWORD = readRequiredEnv('VITE_NEO4J_PASSWORD', import.meta.env.VITE_NEO4J_PASSWORD);
export const NEO4J_BROWSER_URL = readRequiredEnv(
  'VITE_NEO4J_BROWSER_URL', import.meta.env.VITE_NEO4J_BROWSER_URL,
);
export const NEO4J_QUERY_LIMIT = readPositiveIntegerEnv(
  'VITE_NEO4J_QUERY_LIMIT', import.meta.env.VITE_NEO4J_QUERY_LIMIT,
);
