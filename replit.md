# Contact Builder - AI-Powered Contact Profile Generation

## Overview

Contact Builder is an AI-driven system that automatically constructs comprehensive, verified contact profiles from minimal input (documents, resumes, PDFs, business cards, images). The application leverages OCR, NLP, and OSINT (Open Source Intelligence) to extract, enrich, and verify contact information, then outputs CRM-ready formats (vCard, CSV, JSON, HubSpot integration).

**Core Capabilities:**
- Document parsing and AI extraction (Gemini AI)
- Multi-source data enrichment (GitHub, ORCID, academic profiles)
- Intelligent deduplication and confidence scoring
- Semantic natural language search
- Privacy-compliant OSINT aggregation (GDPR-aware)

**Target Users:** Recruiters, journalists, HR professionals, and individuals managing contact databases

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React 18+ with TypeScript, built using Vite

**Routing:** Wouter (lightweight client-side routing)

**State Management:**
- TanStack Query (React Query) for server state and API caching
- Local component state with React hooks
- No global state management library (rely on Query cache)

**UI Component System:**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library (customizable, copy-paste approach)
- Tailwind CSS for styling with custom design system

**Design Philosophy:**
- Monochromatic foundation (pure black/white with 6-shade grayscale)
- Single vibrant accent color for CTAs and highlights (electric blue or neon green)
- Typography: Inter/DM Sans primary, Space Grotesk for display, JetBrains Mono for code
- Professional minimalism meets gamification (CRM-like data density with engaging UX)

**Key Pages:**
- Landing: Public marketing/authentication entry point
- Dashboard: Contact browsing with semantic search, filtering, export
- Upload: Drag-and-drop document upload with real-time processing status
- Profile: User settings and API key management

### Backend Architecture

**Runtime:** Node.js with Express.js server

**Language:** TypeScript with ES modules

**API Pattern:** RESTful JSON API with file upload support

**Authentication:**
- Replit Auth (OpenID Connect) with Passport.js strategy
- Session-based authentication using express-session
- PostgreSQL session store (connect-pg-simple)
- Protected routes via isAuthenticated middleware

**File Upload:**
- Multer middleware for multipart/form-data
- 10MB file size limit
- Supported formats: PDF, DOCX, PNG, JPG, plain text
- Temporary storage in `/uploads` directory

**AI Integration Services:**

1. **Document Extraction (Gemini AI):**
   - Google Generative AI SDK (`@google/genai`)
   - Processes uploaded documents (OCR + NLP)
   - Extracts: name, email, phone, company, title, skills, education, experience
   - Returns structured JSON contact data

2. **Data Enrichment (Multi-Source OSINT):**
   - GitHub API: repositories, bio, skills from languages
   - ORCID API: academic profile, publications, employment
   - Future: Kaggle, Google Scholar, OpenCorporates, social platforms
   - All sources respect robots.txt and ToS

3. **Deduplication (HuggingFace):**
   - Text similarity scoring via HuggingFace API
   - Prevents duplicate contact creation (>85% similarity threshold)
   - Entity resolution across multiple document sources

4. **Semantic Search:**
   - Natural language query processing via Gemini
   - "Find Python developers with ML experience" style queries
   - Returns ranked contact matches

**API Routes:**
- `POST /api/documents/upload` - Upload and extract document
- `GET /api/contacts` - List all user contacts
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts/search` - Semantic search
- `GET /api/documents` - List upload history with processing status
- `POST /api/api-keys` - Store encrypted third-party API credentials
- `GET /api/auth/user` - Current authenticated user

### Data Storage

**Database:** PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)

**ORM:** Drizzle ORM with schema-first approach

**Schema Design:**

```
users
├─ id (primary key)
├─ email, firstName, lastName
└─ profileImageUrl, timestamps

contacts
├─ id (primary key)
├─ userId (foreign key to users)
├─ name, email, phone
├─ company, title, location
├─ skills (array), bio
├─ linkedinUrl, githubUrl, websiteUrl
├─ education (JSONB), experience (JSONB)
├─ enrichmentData (JSONB - sources, confidence)
├─ publications (JSONB), repositories (JSONB)
└─ confidenceScore, createdAt, updatedAt

documents
├─ id (primary key)
├─ userId (foreign key to users)
├─ filename, mimeType, fileSize, filePath
├─ status (pending/processing/completed/failed)
├─ extractedData (JSONB)
├─ contactId (foreign key to contacts - after extraction)
└─ uploadedAt, processedAt

api_keys
├─ id (primary key)
├─ userId (foreign key to users)
├─ service (gmail, hubspot, gemini, huggingface)
├─ keyName (api_key, client_id, client_secret)
├─ encryptedValue (text)
└─ isValid, lastValidated

extraction_jobs
├─ id (primary key)
├─ documentId (foreign key to documents)
├─ status, progress
└─ timestamps

sessions (for Replit Auth)
├─ sid (primary key)
├─ sess (JSONB)
└─ expire
```

**Data Patterns:**
- JSONB for flexible nested data (education, experience, sources)
- Cascade deletion on user removal
- Confidence scoring for data quality tracking
- Source attribution for every enriched field (GDPR transparency)

### External Dependencies

**AI/ML Services:**
- Google Gemini API - Document extraction and semantic search (requires API key)
- HuggingFace Inference API - Text similarity for deduplication (requires API key)

**Database:**
- Neon PostgreSQL - Serverless Postgres database (requires DATABASE_URL)

**Authentication:**
- Replit Auth (OIDC) - User authentication (requires REPL_ID, SESSION_SECRET)

**Data Sources (Public APIs):**
- GitHub API - Profile, repositories, commit activity (optional token for rate limits)
- ORCID API - Academic profiles, publications (public, no auth)
- Future integrations: Kaggle, Google Scholar, OpenCorporates, Reddit, Twitter

**Environment Variables Required:**
```
DATABASE_URL - Neon PostgreSQL connection string
GEMINI_API_KEY - User-provided or app-level Gemini API key
HUGGINGFACE_API_KEY - Optional for deduplication
GITHUB_TOKEN - Optional for increased API rate limits
SESSION_SECRET - Secure random string for session encryption
REPL_ID - Replit deployment identifier (auto-provided)
ISSUER_URL - OIDC issuer (defaults to https://replit.com/oidc)
```

**Privacy & Compliance:**
- Only public data sources accessed (no login-required scraping)
- GDPR-compliant data collection (user consent, data minimization)
- No sensitive special-category data (health, religion)
- Source attribution for all enriched data
- User-controlled API keys (encrypted storage)