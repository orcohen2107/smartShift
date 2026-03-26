# AGENTS.md — SmartShift Repo Guide

> מסמך זה מגדיר איך לעבוד על המאגר הזה בעזרת Codex (planner/builder/reviewer) ומה חשוב לדעת על הארכיטקטורה, הכלים והנהלים.

## Scope & Principles
- תקף לכל העץ מהשורש של המאגר.
- דיבור עם המשתמשים בעברית; קוד, שמות קבצים ומזהים באנגלית.
- שינויים קטנים, ממוקדים ובטוחים. לפני שינוי לא טריוויאלי – להציע תכנית קצרה.
- אין לערוך סודות/`.env` ללא בקשה מפורשת.
- זרימת עבודה מועדפת: planner ▶ builder ▶ reviewer.

## Project Overview
- מסגרת: Next.js (App Router) + React.
- דאטה: Supabase (SDK v2, RLS).
- עיצוב: Tailwind CSS v4 (עם `@tailwindcss/postcss`), תמיכה ב‑RTL ו‑Dark Mode.
- שפת קוד: TypeScript (strict, alias `@/*`).

### Key Directories
- `app/` — מסכים ונתיבי App Router, כולל API Route Handlers תחת `app/api/**`.
- `components/` — רכיבים משותפים (UI/Layout/Dashboard/Assignments).
- `features/{assignments,constraints,profile,workers}` — קוד לפי תחום: `components/`, `contexts/`, `hooks/`, `server/`.
- `lib/` — תשתיות: `db/` (Supabase clients), `auth/` (requireUser/Manager), `api/` (apiFetch), `utils/` (enums, interfaces, types), `assignments/` (לוגיקת autofill).
- `public/` — נכסים סטטיים.
- `supabase/migrations/` — מיגרציות DB (קבצי `.sql`).
- קונפיגים: `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.prettierrc`, `next.config.ts`.

## Commands
- פיתוח: `yarn dev` (או `npm run dev`).
- בנייה: `yarn build`  · הרצה: `yarn start`.
- לינט: `yarn lint`.
- בדיקות: טרם קיימות סקריפטים; כשתתווסף תשתית בדיקות, הוסיפו `test`/`test:watch`.

## Environment
- נדרשים: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. אופציונלי: `SUPABASE_SERVICE_ROLE_KEY` (ל‑admin בלבד).
- אין להעלות/לשנות `.env.local` בגיט.
- קוד שרת משתמש ב‑`lib/db/supabaseServer.ts` או `supabaseAdmin.ts`; קוד דפדפן ב‑`supabaseBrowser.ts`.
- פעולות עוקפות RLS מותרות רק לאחר אימות והרשאה (ראה `requireManager`).

## Auth & API
- צריכת API מצד לקוח דרך `lib/api/apiFetch.ts` שמזריק Bearer מה‑Supabase session.
- במסלולי API (`app/api/**/route.ts`):
  - לאמת משתמש עם `requireUser` / מנהל עם `requireManager`.
  - להחזיר JSON עקבי עם סטטוסים נכונים; לטפל בשגיאות בצורה מפורשת.
  - אם מוסיפים ולידציה, העדיפו Zod וצרו `lib/utils/schemas/<domain>.ts` (אם לא קיים).

## Styling & UI
- Tailwind הוא ברירת המחדל.
- קיימת תלות מינימלית ב‑`styled-components`; אם נוגעים בקומפוננטה קיימת ורלוונטי – להעדיף מעבר ל‑Tailwind.
- לשמור RTL ו‑Dark Mode: מחלקת `.dark` ו‑CSS Variables מוגדרות ב‑`app/globals.css`.

## Database & Migrations
- להוסיף מיגרציות חדשות ל‑`supabase/migrations/` בשם מסודר זמן: `YYYYMMDDHHMMSS_description.sql`.
- לשמור על RLS וחוקי הרשאות; לא לעקוף RLS ללא צורך ו‑audit.

## Testing Policy
- מסגרת מומלצת: Vitest.
- מיקום בדיקות: ליד השירותים (`features/*/server/__tests__`) וליד מסלולי API (`app/api/**/__tests__`).
- למנוע תלות ב‑DB אמיתי בבדיקות יחידה — למקד את Supabase באמצעות שכבת עזר/Factories. בדיקות אינטגרציה מול DB אפשריות ב‑CI בהמשך.

## Linting & Formatting
- ESLint: `eslint.config.mjs` (מבוסס `eslint-config-next`).
- Prettier + `prettier-plugin-tailwindcss`.
- אין לבטל כללים גלובליים בלי תיעוד מקומי.

## Performance & Security Guidelines
- לא לבצע קריאות רשת בצד הלקוח ללא `apiFetch` (כדי לשמור על Auth עקבי).
- למסלולי API רגישים (כגון `assignments/autofill/**`, `auth/signup`) מומלץ להוסיף Rate Limiting (In‑Memory לפיתוח; שירות חיצוני ב‑Prod).
- לא לשמור נתוני רגישות בלוגים. לוגים צריכים להיות תמציתיים ובטוחים.

## Planner → Builder → Reviewer
- Planner:
  - מוודא הקשר, מציע תכנית קצרה (רשימת קבצים לשינוי/הוספה, הנחות, סיכונים).
  - בודק התאמה לכללי המסמך הזה לפני יישום.
- Builder:
  - מיישם שינויים ממוקדים בהתאם לתכנית.
  - מעדכן תיעוד/קונפיג רלוונטיים.
  - לא נוגע ב‑`.env*` ולא מוסיף תלויות כבדות ללא אישור.
- Reviewer:
  - ממצאים → סיכונים → בדיקות חסרות (במבנה זה).
  - בודק לינט/טייפצ׳ק/בניה עוברים.

## Git & PRs
- ענפים: `codex/<short-topic>` למהלכי Codex.
- Commits באנגלית, תמציתיים; ניתן להשתמש ב‑Conventional Commits (מומלץ).
- PR צריך לכלול: תקציר שינוי, קבצים שנגעו, צעדי בדיקה ידניים, סיכונים ידועים/גלגל שיחזור.

## Definition of Done (DoD)
- Build, lint ו‑typecheck עוברים.
- כיסוי בדיקות בסיסי (לכל הפחות Happy‑path לשירות/מסלול חדש).
- תיעוד רלוונטי עודכן (README/AGENTS/COMMENTS בקוד במידת הצורך).
- אין רגרסיה נראית לעין ב‑RTL/Dark Mode.

## Do & Don’t (TL;DR)
- Do:
  - להעדיף Tailwind, לוגיקה בשכבת `features/*/server`, שימוש ב‑`apiFetch`.
  - להשתמש ב‑`requireUser`/`requireManager` לכל גישה מוגנת.
  - לשמור מבנה תיקיות ו‑aliases כפי שהם.
- Don’t:
  - לא לעקוף RLS ללא הצדקה.
  - לא להוסיף ספריות כבדות/גלובליות ללא אישור.
  - לא לשנות `.env.local`.

—
מסמך זה חי ומתעדכן עם התקדמות הפרויקט. אם אינך בטוח – הרץ את ה‑planner והצע תכנית לפני יישום.
