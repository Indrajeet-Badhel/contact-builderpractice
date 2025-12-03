# Contact Builder

![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![MIT License](https://img.shields.io/badge/license-MIT-green.svg)
![GitHub Stars](https://img.shields.io/github/stars/contact-builderpractice?style=social)

## Overview

**Contact Builder** is an AI-powered contact intelligence platform that transforms resumes, business cards, and documents into comprehensive, verified contact profiles. Using advanced NLP, OSINT, and knowledge graph technology, it extracts, enriches, and organizes contact data from public sources, creating CRM-ready profiles with confidence scoring.

It is built with a full **TypeScript + React + Node/Express + Drizzle ORM** stack.

### Key Features:
**AI-Powered Document Processing** - Extracts data from PDFs, DOCX, images, and text files
**Multi-Source Enrichment** - Aggregates data from GitHub, ORCID, Stack Overflow, Wikipedia, and more
**Semantic Search** - Natural language queries like "Find Python developers in San Francisco"
**Confidence Scoring** - AI-powered validation of extracted data
**Intelligent Deduplication** - Prevents duplicate contacts using similarity algorithms
**CRM-Ready Exports** - Export to Excel, CSV, JSON, or vCard formats
**Privacy-First** - GDPR-compliant, only accesses public data sources
**Interactive Visualization** - 2D and 3D contact network graphs

### **User Features**
- Upload PDF, DOCX, image files
- Extract contact fields (name, phone, email, organization, etc.)
- View enriched contact details
- Preview & edit extracted contacts
- Visualize contacts through interactive graphs
- Manage personal profile & logout

### **Admin Features**
- Log in with admin credentials
- View/monitor processed contacts
- Trace and audit data extraction logs
- Manage confidence scoring & enrichment workflows

### **AI & Automation Features**
- Text extraction via Gemini API  
- NLP-based enrichment (HuggingFace models)  
- Contact merging and deduplication  
- Confidence score improvements  
- Semantic search on contacts  
- Email import (experimental)

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Visualization**: Cytoscape.js (2D) & React Force Graph 3D
- **Routing**: Wouter

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL (with Neon serverless option)
- **ORM**: Drizzle ORM
- **AI Services**: Google Generative AI (Gemini), Hugging Face, Google APIs
- **Authentication**: Session-based with memorystore
- **File Handling**: Multer for document uploads

### Additional Tools
- **OCR**: Tesseract, EasyOCR
- **NLP**: spaCy, Hugging Face Transformers
- **Data Enrichment**: GitHub API, ORCID, Stack Overflow, Wikipedia
- **Testing**: Jest, React Testing Library

## Installation

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Neon serverless)
- Google Gemini API key (for document extraction)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Indrajeet-Badhel/contact-builderpractice.git
   cd contact-builderpractice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   SESSION_SECRET=your-secure-random-string-here
   GEMINI_API_KEY=your-gemini-api-key
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

---

## API Routes

| Route              | Method | Description                       |
| ------------------ | ------ | --------------------------------- |
| `/api/upload`      | POST   | Upload document & extract contact |
| `/api/search`      | GET    | Semantic search contacts          |
| `/api/dashboard`      | GET   | View all contacts for user              |
| `/api/logout`      | GET    | Destroy session                   |
| `/api/admin/contacts`    | GET    | Fetch all contacts from all users              |

---

## Graph Features

Two visualization components:

* **`ContactGraph.tsx`**
* **`Contact2Graph.tsx`**

Based on Cytoscape:

* Node types: Person, Organization, Email, Phone
* Displays enriched links and relationships
* Interactive panning, zooming, node expansion

---

## Security Layer

The backend includes:

* AES-256-GCM encryption (`encryption.ts`)
* Rate limiting (`rateLimiter.ts`)
* Input validation (`validation.ts`)
* Admin auth (`adminAuth.ts`)
* Audit logging (`auditLogger.ts`)
* Custom security headers (`header.ts`)

---

## Storage Layer

`storage.ts` handles:

* File uploading
* Directory management
* Document extraction
* Caching extracted data

---

## Usage

### Basic Workflow

1. **Login**: Navigate to `/login` and authenticate
2. **Configure API Keys from profile**: Add your Gemini API key and other service keys
3. **Upload Documents**: Drag & drop or click to upload resumes, business cards, or PDFs
4. **View Contacts**: Browse extracted contacts with enriched data
5. **Search & Filter**: Use semantic search to find specific contacts
6. **Export**: Export contacts to Excel, CSV, JSON, or vCard formats

## Project Structure

```
contact-builderpractice/
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   └── lib/              # Utility functions
│   ├── index.html            # Entry HTML file
│   └── vite.config.ts        # Vite configuration
├── server/                  # Backend Express server
│   ├── security/             # security handlers
│   ├── routes/               # API route handlers
│   └── index.ts              # Server entry point
├── shared/                  # Shared types and schemas
│   └── schema.ts             # Database schema definitions
├── public/                  # Static files
├── .env                     # Environment variables
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✔ |
| `SESSION_SECRET` | Session secret for authentication | ✔ |
| `GEMINI_API_KEY` | Google Gemini API key for document processing | ✔ |
| `GITHUB_TOKEN` | GitHub API token for enrichment | X |
| `HUGGINGFACE_API_KEY` | Hugging Face API key for NLP | X |

### Customization Options

1. **Design System**: Modify `tailwind.config.ts` and `client/src/index.css` for custom styling
2. **API Keys**: Configure additional enrichment services in the Profile settings
3. **Document Processing**: Adjust the AI processing pipeline in `server/services/document-processor.ts`
4. **Visualization**: Customize the graph layouts in `client/src/components/ui/ContactGraph.tsx`

## Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started

1. **Fork the repository** and create your feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up your development environment** as described in the Installation section

### Development Workflow

1. **Write tests**: Add tests for new features
2. **Follow coding standards**: Use TypeScript for type safety
3. **Commit your changes**:
   ```bash
   git commit -m "feat: add new feature"
   ```
4. **Push to the branch**:
   ```bash
   git push origin feature/your-feature
   ```
5. **Open a Pull Request**: Describe your changes clearly

### Code Style Guidelines

- Use **TypeScript** for all new code
- Follow **shadcn/ui** component patterns
- Write **clear, concise commit messages**
- Add **JSDoc comments** for all public APIs
- Keep **functions small and focused**


## Authors & Contributors

**Maintainers**:
- [Indrajeet Badhel](https://github.com/Indrajeet-Badhel)
- [Sidra Jahangir](https://github.com/Itz-Sidra)
- [Tanishq Jadhav](https://github.com/tanishq79)
- [Jayshree](https://github.com/Jayshree-08)
- [Ishan Gupta](https://github.com/Ishano246)


**Special Thanks**:
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [TanStack Query](https://tanstack.com/query/latest) - State management
- [Drizzle ORM](https://orm.drizzle.team/) - Database abstraction

## Issues & Support

### Reporting Issues

If you encounter any problems or have feature requests:

1. **Search existing issues** - Check if your issue has already been reported
2. **Create a new issue** - Include:
   - Clear description of the problem
   - Steps to reproduce
   - Expected behavior
   - Your environment (Node.js version, OS, etc.)
   - Any relevant code snippets

### Getting Help

- **Discussions**: Join our [GitHub Discussions](https://github.com/Indrajeet-Badhel/contact-builderpractice/discussions)

## Roadmap

### Current Version (v1.0.0)
- Basic contact extraction and enrichment
- Document processing pipeline
- Simple UI for browsing contacts

### Planned Features

**Q1 2025**
- [ ] Enhanced semantic search capabilities
- [ ] Advanced graph visualization options
- [ ] Mobile app support
- [ ] API documentation improvements

**Q2 2025**
- [ ] Team collaboration features
- [ ] Contact management workflows
- [ ] Integration with popular CRMs
- [ ] Advanced analytics dashboard

**Future**
- [ ] Machine learning model improvements
- [ ] More data enrichment sources
- [ ] Plugin architecture for custom processing
- [ ] Enterprise-grade security features

## Show Your Support

If you find Contact Builder useful, please consider:

- ⭐ **Starring** this repository
- 💬 **Sharing** your feedback
- 🤝 **Contributing** to the project
- 📢 **Spreading the word** about this tool

Together we can make Contact Builder the most powerful contact intelligence platform available!