// Global test setup
import { config } from 'dotenv';

// Load environment variables for testing
config();

// Set test environment variables if not already set
if (!process.env.TWENTYI_API_KEY) {
  process.env.TWENTYI_API_KEY = 'test-api-key';
}
if (!process.env.TWENTYI_OAUTH_KEY) {
  process.env.TWENTYI_OAUTH_KEY = 'test-oauth-key';
}
if (!process.env.TWENTYI_COMBINED_KEY) {
  process.env.TWENTYI_COMBINED_KEY = 'test-combined-key';
}

// Global test timeout
jest.setTimeout(30000);