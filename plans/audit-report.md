# 🔍 Audit Report: KTD Store (jakmall-clone)

**Date:** 2026-09-13
**Project:** Next.js 16 E-Commerce Storefront
**Stack:** Next.js 16.3.3 · React 19.2.8 · Tailwind CSS v4 · TypeScript 5
**Deployment Target:** Vercel (serverless)

---

## 📋 Executive Summary

KTD Store is a dropshipping e-commerce storefront that scrapes product data from `anekadropship.id` and presents it to customers. Orders are placed via WhatsApp, and shipping rates are calculated through the KiriminAja API. The codebase is generally well-structured with good SEO practices (JSON-LD, OpenGraph, sitemap), but has several critical security concerns, code organization issues, and missing production-ready features.

### Overall Rating: 6.2/10

| Category | Score | Status |
|----------|-------|--------|
| Security | 4/10 | 🔴 Needs Attention |
| Code Quality | 5/10 | 🟡 Fair |
| Architecture | 6/10 | 🟡 Fair |
| Performance | 5/10 | 🟡 Fair |
| SEO | 8/10 | 🟢 Good |
| Accessibility | 5/10 | 🟡 Fair |
| DevOps/Infra | 3/10 | 🔴 Needs Attention |
| Production Readiness | 4/10 | 🔴 Needs Attention |

---

## 🔴 1. SECURITY AUDIT (CRITICAL)

### 1.1 Hardcoded Secrets in Source Code — Severity: HIGH

| File | Line | Issue |
|------|------|-------|
| `src/lib/config.ts` | 65 | WhatsApp number `6285171157938` hardcoded as default |
| `src/lib/config.ts` | 121 | Real bank account `1340025493742` a/n KUSTORO exposed |

**Fix:** Remove all hardcoded defaults. Use only env vars with validation. Add `.env.example`.

### 1.2 Unprotected Admin API Routes — Severity: HIGH

These routes have **zero authentication**:
- `/api/admin/sync-images` — Image sync endpoint
- `/api/admin/dump-product` — Product data dump
- `/api/admin/shipping-status` — Shipping status

**Fix:** Add API key auth or Next.js middleware for all `/api/admin/*` routes.

### 1.3 XSS via dangerouslySetInnerHTML — Severity: MEDIUM

Product descriptions rendered via `dangerouslySetInnerHTML` in `ProductDetailView.tsx`. Mitigated by `sanitize.ts` which strips scripts, styles, iframes, and event handlers. Adequate but not comprehensive.

**Fix:** Use `DOMPurify` (isomorphic) or `sanitize-html` for production-grade sanitization.

### 1.4 No Rate Limiting — Severity: MEDIUM

All API routes lack rate limiting. Risk of:
- Serverless function cost exhaustion
- Upstream scraping bans from anekadropship.id
- KiriminAja API rate limit blocks

**Fix:** Add `@vercel/rate-limit` or custom in-memory rate limiter.

### 1.5 Error Message Leakage — Severity: LOW

API routes return raw error messages to clients, potentially leaking infrastructure details.

**Fix:** Log detailed errors server-side; return generic messages in production.

---

## 🟡 2. CODE QUALITY AUDIT

### 2.1 Oversized Files

| File | Lines | Action |
|------|-------|--------|
| `src/lib/anekadropship.ts` | 677 | Split into client.ts, parser.ts, types.ts |
| `src/components/ProductDetailView.tsx` | 454 | Extract VariantSelector, ImageGallery, ProductInfo |
| `src/components/Header.tsx` | 364 | Extract MobileDrawer, MegaMenu, CartDropdown |
| `src/app/produk/PlpContent.tsx` | 244 | Extract Pagination, CategorySidebar |

### 2.2 Duplicate Caching — 6+ implementations

Every file implements its own cache with different TTLs and eviction strategies. Create a shared `cache.ts` utility.

### 2.3 ESLint Disables

- `set-state-in-effect` in `cart.tsx` (legitimate for hydration)
- `@next/next/no-img-element` everywhere (should migrate to `next/image`)
- Mixed Indonesian/English in comments

### 2.4 Scripts Excluded from Type Checking

`tsconfig.json` excludes the `scripts/` directory (70+ TypeScript files).

---

## 🟡 3. ARCHITECTURE AUDIT

### Data Flow

```
anekadropship.id → [cheerio scraping] → AnekaClient → API Routes + Server Components
                                                              ↓
KiriminAja API → /api/shipping/* → Client Components (useApi hook)
```

**Issues:**
- Scraping is fragile — any HTML change on source breaks the catalog
- No circuit breaker for upstream failures
- No unified caching layer
- No data access layer abstraction

### Caching Strategy (Inconsistent)

| Layer | Implementation | Status |
|-------|---------------|--------|
| CDN/Edge | Cache-Control headers | ✅ Consistent |
| ISR | revalidate: 300 | ✅ On listing pages |
| Server Memory | Multiple Map instances | ❌ Fragmented |
| Client Memory | useApi hook cache | ✅ Single impl |

---

## 🟡 4. PERFORMANCE AUDIT

### 4.1 Image Optimization — CRITICAL

**Every image uses native `<img>` instead of `next/image`.** No WebP/AVIF conversion, no lazy loading (except manual), no blur placeholders, no size optimization.

**Fix:** Migrate to `next/image`. Configure `remotePatterns` in `next.config.ts` for external images.

### 4.2 Large Client Bundles

- `ProductDetailView.tsx` (454 lines) — variant logic, gallery, WhatsApp modal, marketplace buttons
- `Header.tsx` (364 lines) — mega menu, cart dropdown, mobile drawer

**Fix:** Code-split with `next/dynamic` for below-the-fold components.

### 4.3 Missing Optimizations

- No `<link rel="preconnect">` for external origins
- No bundle analyzer configured
- No suspense boundaries for streaming

---

## 🟢 5. SEO AUDIT

### Strengths ✅

- JSON-LD: WebSite, Organization, Product, BreadcrumbList
- OpenGraph + Twitter Cards on all pages
- Sitemap + Robots.txt
- Canonical URLs
- Dynamic meta descriptions
- Semantic HTML

### Issues ❌

- Search result pages have `noindex` (intentional but limits long-tail SEO)
- Sitemap only includes page 1 products
- Some gallery images lack descriptive alt text

---

## 🟡 6. ACCESSIBILITY AUDIT

### Strengths ✅

- Semantic HTML, aria-label, aria-expanded, role="alert"
- Keyboard navigation (Escape to close menus)
- Focus visible styles

### Issues ❌

- **No skip-to-content link** (critical)
- Color contrast may not meet WCAG AA (`text-muted-2` #828184)
- Some divs with onClick instead of buttons
- Mobile drawer doesn't trap focus
- No `prefers-reduced-motion` support

---

## 🔴 7. INFRASTRUCTURE & DEVOPS AUDIT

### Missing Critical Files

| File | Purpose |
|------|---------|
| `.env.example` | Document required env vars |
| `vercel.json` | Deployment configuration |
| `.github/workflows/` | CI/CD pipeline |

### Required Environment Variables (Undocumented)

| Variable | Required? |
|----------|-----------|
| `ANEKA_EMAIL` | ✅ Required |
| `ANEKA_PASSWORD` | ✅ Required |
| `KIRIMINAJA_API_KEY` | ✅ Required |
| `KIRIMINAJA_ORIGIN_DISTRICT` | ✅ Required |
| `NEXT_PUBLIC_SITE_URL` | Optional |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Optional (has hardcoded fallback) |
| `KIRIMINAJA_BASE_URL` | Optional (defaults to sandbox) |
| `KIRIMINAJA_XFF_IP` | Optional |

### Missing Observability

- No error tracking (Sentry)
- No performance monitoring (Analytics)
- No logging framework
- No testing framework (Jest, Vitest, Playwright)

---

## 🔴 8. PRODUCTION READINESS GAPS

### Critical (P0)

1. Admin API authentication
2. Rate limiting on all API routes
3. Error monitoring (Sentry/Vercel Analytics)
4. `.env.example` file
5. Remove hardcoded secrets

### High (P1)

6. Migrate to `next/image`
7. Input validation with Zod
8. Loading skeletons for all dynamic pages
9. Shared cache utility
10. Split oversized files

### Medium (P2)

11. Testing framework setup
12. CI/CD pipeline
13. PWA support (service worker)
14. Proper logging
15. Admin dashboard

### Low (P3)

16. Replace scraping with API (if available)
17. Database for orders/customers
18. Search analytics
19. Dark mode
20. Multi-language support

---

## 📊 Dependency Health

| Package | Version | Status |
|---------|---------|--------|
| next | 16.3.3 | 🟢 Latest |
| react | 19.2.8 | 🟢 Latest |
| cheerio | ^1.2.0 | 🟢 Stable |
| lucide-react | ^1.37.0 | 🟢 Stable |
| tailwindcss | ^4 | 🟢 Latest |
| typescript | ^5 | 🟢 Stable |
| xlsx | ^0.18.5 | 🟡 In devDeps, used by scripts |

### Recommended Additions

- `dompurify` — Production HTML sanitization
- `zod` — Runtime validation
- `@vercel/rate-limit` — API rate limiting

---

## 🎯 Immediate Action Items (Week 1)

1. ✏️ Create `.env.example` with all required variables
2. ✏️ Remove hardcoded WhatsApp number and bank account from `config.ts`
3. ✏️ Add authentication to `/api/admin/*` routes
4. ✏️ Add rate limiting to all API routes
5. ✏️ Add Zod validation to API route inputs

---

*Full interactive report with clickable source links available. Ask for details on any section.*