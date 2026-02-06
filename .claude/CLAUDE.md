# AI Instructions

You must read `CODEBASE_RULES.md` for full workflow. Key points for AI:

- **Section 1 (HUMAN EDITS ONLY):** Do not edit without explicit human approval
- **Section 2 (HUMAN + AI):** Can collaborate freely
- If docs and code conflict, ask — don't assume
- Log your changes: `YYYY-MM-DD :: [author] :: [summary]` (author refers to the user responsible for the AI)

## Code Quality Requirements

### Linting and Formatting

- **Python code**: All Python code must have `ruff` run on it before committing. Run `ruff check --fix` and `ruff format` to lint and format.
- **TypeScript/JavaScript**: Run `npm run lint` to check for ESLint issues.

### Style Guidelines

- Never use emojis in code, comments, commit messages, or documentation.
- Keep code simple and readable. Prefer clarity over cleverness.
- Use descriptive variable and function names.
- Write self-documenting code; add comments only when the logic is not self-evident.

### General Quality Standards

- Follow existing patterns in the codebase.
- Avoid over-engineering. Only make changes that are directly requested or necessary.
- Do not add unnecessary abstractions, utilities, or helpers for one-time operations.
- Keep functions small and focused on a single responsibility.
- Handle errors appropriately but do not add excessive error handling for scenarios that cannot occur.
- Validate at system boundaries (user input, external APIs) but trust internal code.

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Testing

- Run tests with `npm run test` before committing changes.
- Ensure new features have appropriate test coverage.
