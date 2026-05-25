# Knowledge Hack

An AI-powered quiz platform for teachers. Create, host, and play knowledge-based games in the classroom.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Edge Functions, Realtime)
- **AI**: Google Gemini via Google AI Studio

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/nigatheata-spec/knowledge-hack.git
cd knowledge-hack
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Fill in your values:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — from your Supabase project settings
- Get a free `GOOGLE_API_KEY` from [Google AI Studio](https://aistudio.google.com)

### 3. Set up Supabase

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Apply migrations
supabase db push

# Set the Google AI secret for edge functions
supabase secrets set GOOGLE_API_KEY=your_key_here

# Deploy edge functions
supabase functions deploy generate-quiz
supabase functions deploy generate-question-image
```

### 4. Run locally

```bash
npm run dev
```

## Project structure

```
src/
  pages/          # Route pages (teacher dashboard, game, auth)
  components/     # UI components
  integrations/   # Supabase client + generated types
  lib/            # Auth helpers, i18n, utilities
supabase/
  functions/      # Edge functions (AI quiz generation, image generation)
  migrations/     # Database schema migrations
```
