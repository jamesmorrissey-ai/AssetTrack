---
applyTo: "services/web/src/**/*.{astro,ts,tsx}"
description: Engineering standards for AssetTrack's Astro SSR frontend, typed API clients, and selectively hydrated React islands.
---

# Astro and React frontend standards

- Preserve the Astro server-rendered backend-for-frontend architecture. Fetch backend data in Astro frontmatter or server-only modules under `src/lib/api/`; never call internal services directly from browser code.
- Keep service configuration behind `SERVICE_URLS` and `apiFetch`. Read runtime URLs from `process.env`, preserve public API field names and HTTP behavior, and update typed clients and UI consumers together when contracts change.
- Prefer `.astro` pages, layouts, and components for static or server-rendered UI. Add a React island only when interaction requires persistent client-side state, and use the least permissive `client:*` directive that satisfies the requirement.
- Keep React islands small and leaf-oriented. Pass minimal serializable props, avoid duplicating server-fetched state, and do not introduce a client-side application shell, router, or global state library without a demonstrated need.
- Use strict TypeScript throughout. Define precise domain, prop, form, and response types; narrow `unknown` errors safely; avoid `any`, unchecked assertions, non-null assertions, and broad `Partial<T>` payloads when a dedicated input type is clearer.
- Centralize reusable backend calls and error behavior rather than issuing ad hoc `fetch` requests. Encode path and query values, avoid request waterfalls, and run independent service calls concurrently when full success is required.
- Preserve intentional partial-data behavior on dashboard and composition pages. Isolate independent service failures, render successful data, and show clear contextual warnings instead of silently substituting misleading values.
- Render meaningful empty, loading, validation, not-found, and failure states. For SSR pages, avoid client-only loading UI unless hydration is necessary; for islands, prevent layout shift and expose progress with accessible status text.
- Build accessible semantic HTML first. Maintain logical heading order, associated labels, keyboard operation, visible focus, descriptive link/button text, table headers and captions where useful, and `aria-live` or `role="alert"` for dynamic feedback. Do not use ARIA to replace native semantics.
- Use Bootstrap 5 utilities and existing component patterns for layout and visual consistency. Reuse shared components before adding page-specific markup; keep custom CSS small, locally scoped, responsive, and free of unnecessary specificity or `!important`.
- Treat forms as progressive-enhancement workflows. Validate on the server even when client validation exists, preserve submitted values after errors, show field-level messages, and prevent duplicate submissions when an interactive island is used.
- Optimize rendering and payloads: ship no browser JavaScript by default, hydrate only interactive components, avoid large dependencies for simple behavior, request only needed data, and use Astro image or asset handling when adding media.
- Keep components focused and maintainable. Extract repeated UI or transformations, use clear names, minimize side effects, delete obsolete code, and favor small incremental changes over broad rewrites.
- Add no dependency unless existing Astro, React, Web Platform, or Bootstrap capabilities are insufficient. Prefer actively maintained, tree-shakeable packages and document the concrete need in the change.
- Test behavior at the narrowest useful level. Cover pure transformations and React interactions with unit/component tests when test tooling exists; cover Astro routes, forms, accessibility, partial failures, and service-boundary behavior with integration or end-to-end tests when introduced.
- Run `npm run build` from `services/web` after frontend changes. Run the smallest relevant tests when available; do not add a new test or lint framework solely for an unrelated small change.
- Check `exercises.md`, the root README, and `services/web/README.md` before correcting apparent gaps. Some validation, status styling, authentication, and resilience behavior is intentional course material; when intentionally completing an exercise, update the associated documentation.
