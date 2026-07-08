const readRequiredEnv = (name) => {
  const value = import.meta.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readPositiveIntegerEnv = (name) => {
  const value = Number.parseInt(readRequiredEnv(name), 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
};

export const DITTO_API_BASE_URL = readRequiredEnv('VITE_DITTO_API_BASE_URL').replace(/\/+$/, '');
export const DITTO_USERNAME = readRequiredEnv('VITE_DITTO_USERNAME');
export const DITTO_PASSWORD = readRequiredEnv('VITE_DITTO_PASSWORD');
export const DITTO_POLICY_SUBJECT = readRequiredEnv('VITE_DITTO_POLICY_SUBJECT');
export const DITTO_DEVOPS_USERNAME = readRequiredEnv('VITE_DITTO_DEVOPS_USERNAME');
export const DITTO_DEVOPS_PASSWORD = readRequiredEnv('VITE_DITTO_DEVOPS_PASSWORD');

export const DITTO_AUTHORIZATION = `Basic ${btoa(`${DITTO_USERNAME}:${DITTO_PASSWORD}`)}`;
export const DITTO_DEVOPS_AUTHORIZATION = `Basic ${btoa(`${DITTO_DEVOPS_USERNAME}:${DITTO_DEVOPS_PASSWORD}`)}`;

export const HOME_POLL_INTERVAL_MS = readPositiveIntegerEnv('VITE_HOME_POLL_INTERVAL_MS');
export const STATUS_POLL_INTERVAL_MS = readPositiveIntegerEnv('VITE_STATUS_POLL_INTERVAL_MS');
export const SEARCH_PAGE_SIZE = readPositiveIntegerEnv('VITE_SEARCH_PAGE_SIZE');

export const NEO4J_URI = readRequiredEnv('VITE_NEO4J_URI');
export const NEO4J_USER = readRequiredEnv('VITE_NEO4J_USER');
export const NEO4J_PASSWORD = readRequiredEnv('VITE_NEO4J_PASSWORD');
export const NEO4J_BROWSER_URL = readRequiredEnv('VITE_NEO4J_BROWSER_URL');
export const NEO4J_QUERY_LIMIT = readPositiveIntegerEnv('VITE_NEO4J_QUERY_LIMIT');
