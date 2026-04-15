# Security Policy

## 🔒 Security Overview

VIVIM Extension takes security seriously. This document outlines our security practices, how to report security vulnerabilities, and our commitment to protecting user data.

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Data Handling](#data-handling)
3. [API Key Security](#api-key-security)
4. [Network Security](#network-security)
5. [Browser Security](#browser-security)
6. [Third-Party Dependencies](#third-party-dependencies)
7. [Reporting Vulnerabilities](#reporting-vulnerabilities)
8. [Security Updates](#security-updates)
9. [Compliance](#compliance)
10. [Contact](#contact)

---

## Security Principles

### Core Security Commitments

- **Privacy First**: All user data stays on the user's device
- **Zero Data Collection**: No telemetry, analytics, or data transmission to our servers
- **Local Processing**: AI conversations processed locally or via direct API calls only
- **User Control**: Users maintain full control over their data and API keys

### Security by Design

- **Defense in Depth**: Multiple layers of security controls
- **Principle of Least Privilege**: Minimal required permissions
- **Fail-Safe Defaults**: Secure defaults that protect user data
- **Regular Audits**: Ongoing security reviews and updates

---

## Data Handling

### Data Storage

#### Local-First Storage
- **IndexedDB**: Conversations and settings stored locally in browser
- **No Cloud Sync**: Data never transmitted to external servers
- **User-Controlled**: Users manage their own data backups

#### Encryption
- **API Keys**: Encrypted using Web Crypto API (AES-GCM)
- **At Rest**: All sensitive data encrypted before storage
- **In Transit**: HTTPS-only communication with AI providers

### Data Lifecycle

#### Collection
- **Minimal Data**: Only necessary data for functionality
- **User-Generated**: All content created by users
- **Temporary Data**: Session data cleared on browser close

#### Processing
- **Local Processing**: Data processed on user's device
- **No External Processing**: No data sent to third parties except AI APIs
- **Memory Safety**: Sensitive data cleared from memory after use

#### Deletion
- **User-Initiated**: Users can delete conversations and settings
- **Automatic Cleanup**: Temporary data cleared on extension unload
- **Complete Removal**: Extension uninstall removes all stored data

---

## API Key Security

### Key Management

#### Encryption Implementation
```typescript
// AES-GCM encryption with PBKDF2-derived key
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveKey']
);

const key = await crypto.subtle.deriveKey({
  name: 'PBKDF2',
  salt: salt,
  iterations: 100000,
  hash: 'SHA-256'
}, keyMaterial, {
  name: 'AES-GCM',
  length: 256
}, false, ['encrypt', 'decrypt']);
```

#### Storage Security
- **Isolated Storage**: Keys stored in encrypted browser storage
- **Access Control**: Keys accessible only to extension code
- **Memory Safety**: Decrypted keys cleared immediately after use

### Key Usage

#### Direct API Calls
- **No Proxy Servers**: Keys sent directly to AI provider APIs
- **HTTPS Only**: All API communication encrypted
- **Provider Trust**: Rely on provider security (OpenAI, Anthropic, etc.)

#### Key Validation
- **Format Validation**: Keys validated before storage
- **Connectivity Tests**: Optional key testing on user request
- **Error Handling**: Secure error messages without exposing keys

---

## Network Security

### Communication Security

#### HTTPS Enforcement
- **Strict HTTPS**: All external communications use HTTPS
- **Certificate Validation**: Standard browser certificate validation
- **No HTTP Fallback**: HTTP connections rejected

#### Content Security Policy
```javascript
// Extension CSP
"default-src 'self'",
"script-src 'self' 'wasm-unsafe-eval'",
"style-src 'self' 'unsafe-inline'",
"connect-src https://api.openai.com https://api.anthropic.com https://*.googleapis.com",
"img-src 'self' data: https:",
"media-src 'self' data: https: blob:"
```

### Request Security

#### CORS Handling
- **Extension Origins**: Requests originate from chrome-extension://
- **Provider CORS**: AI providers handle CORS for extension requests
- **Error Boundaries**: Network errors handled gracefully

#### Request Limiting
- **Rate Limiting**: Client-side rate limiting to prevent abuse
- **Timeout Protection**: Request timeouts prevent hanging connections
- **Retry Logic**: Secure retry with exponential backoff

---

## Browser Security

### Extension Permissions

#### Minimal Permissions
```json
{
  "permissions": [
    "storage",           // Local data storage
    "tabs",             // Tab information access
    "sidePanel",        // Side panel UI
    "scripting",        // Dynamic script injection
    "activeTab",        // Current tab access
    "contextMenus",     // Right-click menus
    "unlimitedStorage", // Large conversation storage
    "alarms"            // Background tasks
  ]
}
```

#### Permission Justification
- **storage**: Required for conversation persistence
- **tabs**: Needed for web integration features
- **sidePanel**: Core UI functionality
- **scripting**: Required for content script injection
- **contextMenus**: User-initiated AI actions

### Content Script Security

#### Isolated Worlds
- **ISOLATED World**: Content scripts run in separate JavaScript context
- **No DOM Access**: Cannot access page JavaScript variables
- **Message Passing**: Secure communication via chrome.runtime

#### Injection Safety
- **Document Start**: Scripts injected before page content loads
- **Trusted Origins**: Only injected on whitelisted domains
- **Code Integrity**: Scripts bundled and integrity-checked

---

## Third-Party Dependencies

### Dependency Management

#### Security Scanning
- **Automated Scanning**: Dependencies scanned for vulnerabilities
- **Regular Updates**: Dependencies updated to latest secure versions
- **Audit Process**: Manual security review of major updates

#### Trusted Sources
- **NPM Registry**: Official packages only
- **Signed Packages**: Prefer packages with cryptographic signatures
- **Minimal Dependencies**: Only essential dependencies included

### Current Dependencies

#### Production Dependencies
| Package | Version | Purpose | Security Status |
|---------|---------|---------|-----------------|
| `react` | ^18.2.0 | UI framework | ✅ Audited |
| `dexie` | ^3.2.0 | IndexedDB wrapper | ✅ Audited |
| `marked` | ^9.0.0 | Markdown parser | ✅ Audited |
| `highlight.js` | ^11.9.0 | Code highlighting | ✅ Audited |

#### Build Dependencies
| Package | Version | Purpose | Security Status |
|---------|---------|---------|-----------------|
| `vite` | ^5.0.0 | Build tool | ✅ Audited |
| `typescript` | ^5.0.0 | Type checking | ✅ Audited |
| `eslint` | ^8.56.0 | Code linting | ✅ Audited |

### Vulnerability Response

#### Detection
- **Automated Alerts**: GitHub Dependabot security alerts
- **Manual Reviews**: Monthly dependency security reviews
- **Community Reports**: Monitor for reported vulnerabilities

#### Response Process
1. **Alert Received**: Security vulnerability detected
2. **Assessment**: Evaluate impact and exploitability
3. **Fix Development**: Update dependency or implement workaround
4. **Testing**: Comprehensive testing of security fix
5. **Release**: Deploy security update to users

---

## Reporting Vulnerabilities

### Responsible Disclosure

We appreciate security researchers helping keep VIVIM Extension safe. We follow responsible disclosure practices.

#### How to Report

1. **Email**: security@vivim-extension.com
2. **GitHub**: [Private Security Advisory](https://github.com/vivim-org/vivim-extension/security/advisories/new)
3. **Do Not**: Post vulnerabilities publicly until fixed

#### What to Include
- **Description**: Clear description of the vulnerability
- **Impact**: Potential security impact
- **Steps to Reproduce**: Detailed reproduction steps
- **Proof of Concept**: If safe to provide
- **Environment**: Browser version, extension version, OS

#### Our Process
1. **Acknowledgment**: 24-48 hours initial response
2. **Investigation**: 1-2 weeks assessment and fix development
3. **Updates**: Regular progress updates
4. **Fix Release**: Security update deployed
5. **Public Disclosure**: Vulnerability details published after fix

### Bug Bounty

Currently, we do not offer a formal bug bounty program. However, significant security contributions may be eligible for:
- Public recognition in release notes
- Priority consideration for future bounties
- Invitation to contribute as a security advisor

---

## Security Updates

### Update Process

#### Patch Releases
- **Critical Vulnerabilities**: Released within 48 hours
- **High Priority**: Released within 1 week
- **Medium Priority**: Included in next regular release

#### Communication
- **Security Advisories**: Published on GitHub Security tab
- **Release Notes**: Security fixes highlighted in changelogs
- **User Notifications**: Extension update notifications

### Versioning
- **Patch Versions**: Security fixes (2.0.1, 2.0.2)
- **Minor Versions**: New features + security fixes
- **Major Versions**: Breaking changes + comprehensive security review

---

## Compliance

### Privacy Compliance

#### GDPR Compliance
- **Data Minimization**: Only necessary data collected
- **User Consent**: Clear permission requests
- **Right to Deletion**: Users can delete all data
- **Data Portability**: Export functionality provided

#### CCPA Compliance
- **No Sale of Data**: User data never sold or shared
- **Opt-Out Rights**: Users can disable all optional features
- **Data Access**: Users can view all stored data

### Security Standards

#### OWASP Guidelines
- **Input Validation**: All user inputs validated
- **Secure Communications**: HTTPS-only external connections
- **Error Handling**: Secure error messages
- **Access Control**: Proper permission management

#### Browser Extension Security
- **Manifest V3**: Modern security model
- **Content Isolation**: Secure content script execution
- **Permission Justification**: Minimal required permissions

---

## Security Best Practices for Users

### API Key Management
- **Strong Keys**: Use newly generated API keys
- **Limited Permissions**: Create keys with minimal required permissions
- **Regular Rotation**: Rotate keys every 3-6 months
- **Secure Storage**: Use password manager for key backups

### Extension Usage
- **Official Sources**: Only install from Chrome Web Store or official GitHub releases
- **Keep Updated**: Install security updates promptly
- **Monitor Permissions**: Review extension permissions regularly
- **Regular Backups**: Export important conversations periodically

### Network Security
- **HTTPS Only**: Ensure secure connections to websites
- **VPN Usage**: Be aware that some providers may restrict VPN access
- **Public Networks**: Avoid using extension on unsecured public WiFi

### Account Security
- **Provider Accounts**: Use strong passwords for AI provider accounts
- **Two-Factor Authentication**: Enable 2FA on provider accounts when available
- **Billing Alerts**: Monitor API usage and set up billing alerts

---

## Contact

### Security Team
- **Email**: security@vivim-extension.com
- **PGP Key**: Available on request for encrypted communications
- **Response Time**: Within 24 hours for security reports

### General Support
- **Issues**: [GitHub Issues](https://github.com/vivim-org/vivim-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vivim-org/vivim-extension/discussions)
- **Documentation**: [Security FAQ](https://github.com/vivim-org/vivim-extension/wiki/Security-FAQ)

### Emergency Contact
For critical security issues requiring immediate attention:
- **Phone**: +1 (555) 123-4567 (24/7 security hotline)
- **Emergency Email**: emergency@vivim-extension.com

---

## Acknowledgments

- **Security Researchers**: For responsible disclosure contributions
- **Open Source Community**: For security tools and best practices
- **Browser Vendors**: For extension security frameworks
- **AI Providers**: For secure API infrastructure

---

*This security policy is reviewed and updated regularly. Last updated: 2026-04-14*

*VIVIM Extension is committed to maintaining the highest security standards to protect our users' privacy and data.*</content>
<parameter name="filePath">SECURITY.md