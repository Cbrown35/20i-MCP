// Mock client helper for testing
import { AxiosResponse } from 'axios';

export const createMockAxiosResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

export const mockApiCredentials = {
  apiKey: 'test-api-key',
  oauthKey: 'test-oauth-key',
  combinedKey: 'test-combined-key',
};

export const createMockTwentyIClient = () => {
  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    },
    credentials: mockApiCredentials,
  };
};