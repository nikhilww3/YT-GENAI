# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers of every stripe — students and new grads, employed engineers switching
roles, and career switchers coming from another field. No single persona dominates,
so the surface must work for someone who does not yet know what interviewers want
*and* for someone who does and is short on time. They arrive with a specific job
posting in hand and a resume they are unsure about, usually preparing outside work
hours against a real, dated deadline.

## Product Purpose

Turn a resume plus a target job description into a concrete preparation plan. The
product reads both, then produces the interview it predicts: technical questions,
behavioral questions, the intent behind each question, how to answer it, a match
score, a ranked list of skill gaps, and a day-by-day preparation roadmap. Success is
a user walking into a specific interview knowing what will be asked and why.

## Positioning

Two mechanisms a neighboring product could not truthfully copy:

1. **Every question ships with its intent.** Not a question bank — each question
   carries *why they ask this* and *how to answer it*, derived from the specific
   resume/JD pair.
2. **The resume is rewritten, not critiqued.** The product regenerates the user's
   own resume against the target job into a real compiled PDF, preserving their
   actual entries and order while retargeting the language.

It also generates against multiple AI providers, so the same resume/JD pair can be
compared across models.

## Operating Context

Single sitting, one target job at a time. The user pastes a job description,
uploads a resume PDF (or types a self-description), picks an AI provider, waits
through a genuinely slow generation, and reads the resulting report. Generation is
not instant: Gemini is roughly 15 seconds, the free-tier providers can take a
minute or more, and that wait is a designed moment, not an edge case. Reports
accumulate into a history the user returns to.

## Capabilities and Constraints

- Auth: email/username + password, JWT in an httpOnly cookie.
- Generate an interview report from job description + resume PDF and/or
  self-description.
- AI provider is user-selectable per generation: Gemini (default), NVIDIA
  (Llama 3.3 70B), Hugging Face (Llama 3.1 8B). Backend supports generating
  against several at once; the UI currently exposes single-select.
- Report contains: title, match score (0–100), technical questions, behavioral
  questions, skill gaps with low/medium/high severity, and a multi-day
  preparation roadmap.
- Report history list, and a detail view per report.
- Tailored resume: regenerates resume content against the JD, fills a fixed LaTeX
  template, compiles via Tectonic, streams a PDF download. Never stored server-side.
- Rate limited to 10 resume generations per 5 minutes per user.
- Stack: React 19, Vite 8, SCSS, React Router, axios. GSAP 3.15 available.
  Backend: Express 5, MongoDB/Mongoose.

**Terminology:** interview report, match score, skill gaps, preparation roadmap,
tailored resume, provider.

## Brand Commitments

Product name is **ZeroFare** — free interview prep for the fare you can't pay. "Zero"
states the mission (free for students who can't afford paid resume/interview tools),
"fare" is the transit-depot vocabulary the whole surface already speaks (tickets,
boarding, gates, destination codes). Used consistently across the surface. The mark is
a single split-flap character showing "0" (chrome-yellow tile, ink glyph, a horizontal
seam like a real split-flap board) — the site's own signature motion, held still.

## Evidence on Hand

The product is real and working end to end against live AI providers; every
capability above is implemented and has been exercised. Real generated report
content exists and is suitable as design material. There are no customers,
testimonials, usage numbers, press, pricing, or case studies — none may be
invented or implied.

## Product Principles

1. **The specific beats the generic.** Value comes from questions tied to *this*
   resume against *this* job. Never present output that could have come from a
   generic list.
2. **Explain the why, not just the what.** Intent behind a question is the product,
   equal in weight to the question itself.
3. **Never fabricate the user's history.** The resume feature reorders and rewords
   what is really there; it invents nothing.
4. **The wait is part of the product.** Generation takes real time; that time is
   designed for, not hidden or apologized for.
5. **Preparation is finite work.** Output resolves to a plan a person can actually
   execute before a dated interview.

## Accessibility & Inclusion

No product-specific standard established. Motion must respect
`prefers-reduced-motion`, since the redesign is motion-heavy by request.
