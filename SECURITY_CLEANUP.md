# SECURITY CLEANUP REQUIRED

## CRITICAL SECURITY ISSUE
Multiple files contain hardcoded API keys and credentials that must be removed immediately.

## Files Containing Hardcoded Credentials:
- testing-files/*.js (15+ files)
- automation/*.js (40+ files)

## Immediate Actions Required:
1. Remove ALL hardcoded API keys from files
2. Check git history for committed credentials
3. Regenerate API keys if they were committed
4. Implement environment variable usage only

## API Keys Found:
- REDACTED_LEAKED_20I_API_KEY (TWENTYI_API_KEY)
- REDACTED_LEAKED_20I_OAUTH_KEY (TWENTYI_OAUTH_KEY)
- Combined keys and other credentials

## NEVER COMMIT CREDENTIALS TO GIT
All scripts must use environment variables only.

---
Created: 2025-01-08
Status: IMMEDIATE ACTION REQUIRED