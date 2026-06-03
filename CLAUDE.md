## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, mdsvex, storybook, mcp

## API

- **ElysiaJS** is the API framework, mounted at `/api` via a SvelteKit catch-all route (`src/routes/api/[...slugs]/+server.ts`).
- The Elysia app is defined in `src/lib/server/api/index.ts` and exports `App` type for end-to-end type safety.
- **Eden Treaty** (`src/lib/api.ts`) is the type-safe client used on the frontend to call the API. Always use it instead of raw `fetch` for API calls.
- Add new API routes by chaining onto the Elysia app in `src/lib/server/api/` — do not create separate SvelteKit `+server.ts` API routes.

## Database

- **Always use migrations**, never `drizzle-kit push`. Use `bun run db:generate` to create migrations and `bun run db:migrate` to apply them.

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
