# Contact Builder - AI-Powered Contact Profile Generation

## Overview

Contact Builder is an AI-driven system that automatically constructs comprehensive, verified contact profiles from minimal input (documents, resumes, PDFs, business cards, images). The application leverages OCR, NLP, and OSINT (Open Source Intelligence) to extract, enrich, and verify contact information, then outputs CRM-ready formats (vCard, CSV, Excel).

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
- Simple session-based email/password authentication
- In-memory session store (memorystore)
- Protected routes via isAuthenticated middleware
- For production: Replace with Firebase Auth or similar

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
- `POST /api/login` - Authenticate user
- `GET /api/logout` - End session
- `POST /api/documents/upload` - Upload and extract document
- `GET /api/contacts` - List all user contacts
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts/search` - Semantic search
- `GET /api/documents` - List upload history with processing status
- `POST /api/api-keys` - Store third-party API credentials
- `GET /api/auth/user` - Current authenticated user

### Data Storage

**Database:** PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)

**ORM:** Drizzle ORM with schema-first approach

### Running Locally

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - Random string for session encryption
3. Push database schema: `npm run db:push`
4. Start development server: `npm run dev`
5. Open `http://localhost:5000`

**Environment Variables Required:**
```
DATABASE_URL - PostgreSQL connection string
SESSION_SECRET - Secure random string for session encryption (optional, has default)
```

**Optional API Keys (add in Profile page after login):**
- GEMINI_API_KEY - For document extraction
- GITHUB_TOKEN - For GitHub profile enrichment
- HUGGINGFACE_API_KEY - For deduplication

**Privacy & Compliance:**
- Only public data sources accessed (no login-required scraping)
- GDPR-compliant data collection (user consent, data minimization)
- No sensitive special-category data (health, religion)
- Source attribution for all enriched data
