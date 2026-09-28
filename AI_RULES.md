# AI Rules

## Tech Stack
- **React** - UI component library for building the application
- **TypeScript** - Provides type safety and better developer experience
- **React Router** - For client-side routing; all routes must be defined in `src/App.tsx`
- **Tailwind CSS** - Utility-first CSS framework for all styling needs
- **shadcn/ui** - Pre-built, accessible UI components ready to use
- **lucide-react** - Icon library for all icons in the application
- **Radix UI** - Low-level UI primitives that power shadcn/ui components

## Library Usage Rules

### General
- All source code must be placed in the `src/` directory.
- Page components go in `src/pages/`, with the main page being `src/pages/Index.tsx`.
- Reusable components go in `src/components/`.
- Always update the main page (`Index.tsx`) to include new components; otherwise they won't be visible.

### UI & Styling
- Use **shadcn/ui** components for all standard UI elements (buttons, cards, dialogs, forms, etc.).
- Do **not** edit shadcn/ui component files directly. If you need customization, create a new component that wraps or extends the shadcn/ui component.
- Use **Tailwind CSS** utility classes for all styling. Avoid writing custom CSS unless absolutely necessary.
- Import icons exclusively from **lucide-react**.

### Routing
- Define all routes in `src/App.tsx` using React Router.
- Keep route definitions clean and organized.

### State Management
- Prefer React's built-in hooks (`useState`, `useContext`, `useReducer`) for local state.
- Do not introduce external state management libraries without explicit requirement.

### Forms & Validation
- Use shadcn/ui form components together with `react-hook-form` for form handling.
- Validate form data using `zod` schemas integrated with `react-hook-form`.

### Data Fetching
- Use `axios` or the native `fetch` API for HTTP requests.
- Keep API calls in dedicated service modules, separate from UI components.

## Best Practices
- Write clean, readable code with meaningful names.
- Keep components small and focused on a single responsibility.
- Use TypeScript types/interfaces for all props and state.
- Avoid over-engineering; implement only what is needed.
- Do not add error handling for scenarios that cannot occur.
- Follow accessibility best practices; shadcn/ui components are accessible by default.