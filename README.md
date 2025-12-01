# Contact Builder - AI-Powered Contact Intelligence

> Transform resumes, documents, and business cards into comprehensive, verified contact profiles using AI and OSINT enrichment.

![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)

## Overview

Contact Builder is an AI-driven system that automatically constructs comprehensive, verified contact profiles from minimal input. Upload a resume, PDF, business card image, or any professional document, and get back structured, CRM-ready contact data enriched from multiple public sources.

**Key Features:**
- **Smart Document Processing** - AI-powered extraction from PDFs, DOCX, images, and text files
- **Multi-Source Enrichment** - Automatically enriches contacts using GitHub, ORCID, Stack Overflow, Wikipedia, and more
- **Semantic Search** - Natural language queries like "Find Python developers with ML experience"
- **Confidence Scoring** - AI-powered scoring system to validate data accuracy
- **Intelligent Deduplication** - Prevents duplicate contacts using similarity algorithms
- **CRM-Ready Exports** - Export to Excel, CSV, JSON, or vCard formats
- **Privacy-First** - GDPR-compliant, only accesses public data sources

## Quick Start

### Prerequisites

- Node.js 20+ 
- PostgreSQL database (or Neon serverless)
- Gemini API key (required for document extraction)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd contact-builder
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Required
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=your-secure-random-string-here

# Optional (configure via UI after login)
# GEMINI_API_KEY=your-gemini-api-key
# GITHUB_TOKEN=your-github-token
# HUGGINGFACE_API_KEY=your-hf-api-key
```

4. **Initialize database**
```bash
npm run db:push
```

5. **Start development server**
```bash
npm run dev
```

6. **Open your browser**
```
http://localhost:5000
```

## Usage Guide

### 1. Login
- Navigate to `/login`
- Enter any email and password (min 6 characters)
- Simple session-based auth for development

### 2. Configure API Keys
- Go to Profile → API Keys tab
- Add your Gemini API key (required for extraction)
- Optionally add GitHub, HuggingFace, and other service keys for enhanced enrichment

### 3. Upload Documents
- Navigate to Upload page
- Drag & drop or click to upload:
  - Resumes (PDF, DOCX)
  - Business cards (PNG, JPG)
  - Plain text files
- Watch real-time extraction progress

### 4. View & Search Contacts
- Browse extracted contacts on Dashboard
- Use semantic search: *"Show me contacts from San Francisco"*
- View detailed profiles with enriched data from multiple sources
- Export to Excel, CSV, or individual JSON files

## Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- TanStack Query for server state
- Wouter for routing
- shadcn/ui + Radix UI components
- Tailwind CSS

**Backend:**
- Node.js + Express
- PostgreSQL with Drizzle ORM
- Session-based authentication
- Multer for file uploads

**AI Services:**
- Google Gemini AI - Document extraction & semantic search
- HuggingFace - Deduplication & similarity scoring
- GitHub API - Repository & profile enrichment
- ORCID API - Academic profile data
- Stack Exchange, Wikipedia, GitLab, Dev.to APIs for additional enrichment

### Project Structure

```
contact-builder/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities & API client
│   └── index.html
├── server/              # Express backend
│   ├── routes.ts        # API route handlers
│   ├── gemini.ts        # Gemini AI integration
│   ├── enrichment.ts    # Multi-source enrichment
│   ├── huggingface.ts   # Deduplication logic
│   ├── storage.ts       # Database operations
│   └── simpleAuth.ts    # Authentication
├── shared/              # Shared TypeScript schemas
│   └── schema.ts        # Drizzle ORM schemas
└── migrations/          # Database migrations
```

## Configuration

### Supported Data Sources

#### Core Services (Recommended)
- **Gemini AI** - Required for document extraction
- **HuggingFace** - Optional, improves deduplication accuracy
- **GitHub** - Optional, enriches developer profiles

#### Developer Platforms (Free APIs)
- GitHub, GitLab, Stack Overflow, Dev.to, Kaggle, Hashnode, Product Hunt

#### Academic & Research (Free APIs)
- ORCID, Semantic Scholar, OpenAlex, CrossRef, Google Scholar (via SerpAPI)

#### Knowledge Bases (Free APIs)
- Wikipedia, Wikidata, DBpedia, GDELT

#### Professional Data
- OpenCorporates (company registry)
- Gravatar (profile images)

All API keys can be configured securely via the Profile page after login.

## Features Deep Dive

### AI-Powered Document Extraction

Upload any professional document and Gemini AI extracts:
- Name, email, phone, location
- Company, job title
- Skills, education, experience
- Social profiles (LinkedIn, GitHub, website)
- Professional bio/summary

### Multi-Source Enrichment

Automatically enriches contacts by searching:
1. **GitHub** - Repositories, contributions, bio, programming languages
2. **ORCID** - Academic publications, affiliations, research interests
3. **Stack Overflow** - Reputation, badges, expertise areas
4. **Wikipedia/Wikidata** - Notable achievements, biographical data
5. **Other platforms** - GitLab projects, Dev.to articles, etc.

### Confidence Scoring

Each contact receives an AI-calculated confidence score based on:
- Number of verified sources
- Field completeness (email, phone, company, etc.)
- Presence of verifiable links (GitHub, LinkedIn, ORCID)
- Cross-source data consistency

### Intelligent Deduplication

Uses HuggingFace sentence transformers to:
- Detect duplicate contacts (>85% similarity)
- Merge data from multiple sources
- Prevent redundant entries

### Semantic Search

Natural language queries powered by Gemini:
- *"Find Python developers with ML experience"*
- *"Show me contacts from San Francisco"*
- *"Engineers working on AI projects"*

## Privacy & Compliance

- **GDPR Compliant** - Only accesses public data sources
- **No Scraping** - Uses official APIs and respects robots.txt
- **User Consent** - Clear data source attribution
- **Secure Storage** - API keys encrypted at rest
- **No Special Categories** - Avoids health, religion, political data

## Development

### Build for Production

```bash
npm run dev
npm run build
npm run start
```

### Database Management

```bash
# Push schema changes
npm run db:push

# Generate migrations
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | No | Session encryption key (has default) |
| `PORT` | No | Server port (default: 5000) |

API keys are managed via the UI and stored securely in the database.

## API Endpoints

### Authentication
- `POST /api/login` - Email/password login
- `GET /api/logout` - End session
- `GET /api/auth/user` - Current user info

### Contacts
- `GET /api/contacts` - List all contacts
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts` - Create contact
- `PATCH /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/search` - Semantic search

### Documents
- `POST /api/documents/upload` - Upload & extract
- `GET /api/documents` - List uploads
- `DELETE /api/documents/:id` - Delete document

### Export
- `POST /api/contacts/export/excel` - Export to Excel
- `POST /api/contacts/export/csv` - Export to CSV
- `POST /api/contacts/export/vcard` - Export to vCard

### API Keys
- `GET /api/api-keys` - List configured keys
- `POST /api/api-keys` - Add/update key
- `DELETE /api/api-keys/:id` - Remove key
- `POST /api/api-keys/:id/test` - Test connection

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- **Google Gemini** - AI-powered document extraction
- **HuggingFace** - Similarity models for deduplication
- **shadcn/ui** - Beautiful component library
- **Drizzle ORM** - Type-safe database access
- All the open data platforms that make enrichment possible

## Support

- Issues: [GitHub Issues](https://github.com/Indrajeet-Badhel/contact-builderpractice/issues)

---

Built with ❤️