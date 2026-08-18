import gsap from "gsap"

/**
 * Depot Destination Blind motion grammar.
 *
 * The world's rule: nothing glides. Every change steps one whole course,
 * overshoots, and settles. These helpers are the only motion vocabulary the
 * surfaces use, so the page moves like one mechanism rather than a pile of
 * scattered effects.
 *
 * Every helper returns a GSAP tween/timeline so callers can kill it on unmount,
 * and every helper animates from an already-visible default: if JS never runs,
 * or motion is reduced, the content is still there and readable.
 */

export const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/* The signature move: a course stepping up under the fixed window.
   Overshoot then settle is what makes it read as sprung cloth, not a slide. */
export function snapStep(target, { from = "110%", delay = 0, duration = 0.42 } = {}) {
    if (!target) return null
    if (prefersReducedMotion()) {
        gsap.set(target, { yPercent: 0, opacity: 1 })
        return null
    }
    return gsap.fromTo(
        target,
        { yPercent: parseFloat(from), opacity: 0 },
        {
            yPercent: 0,
            opacity: 1,
            duration,
            delay,
            ease: "back.out(1.7)",
        }
    )
}

/* A rank of courses stepping in sequence — used for legend rows and lists.
   Stagger is tight so the whole rank reads as one mechanism turning over. */
export function stepRank(targets, { stagger = 0.05, delay = 0, duration = 0.38 } = {}) {
    const list = gsap.utils.toArray(targets)
    if (!list.length) return null
    if (prefersReducedMotion()) {
        gsap.set(list, { yPercent: 0, opacity: 1 })
        return null
    }
    return gsap.fromTo(
        list,
        { yPercent: 40, opacity: 0 },
        { yPercent: 0, opacity: 1, duration, delay, stagger, ease: "back.out(1.4)" }
    )
}

/**
 * The destination search: the blind riffles through candidate destinations
 * before the real one lands. This is the generation wait state — honest about
 * the machine working, in the world's own language rather than a spinner.
 * Returns a timeline; kill it and call `land()` when the real answer arrives.
 */
export function riffle(el, candidates, { interval = 0.09 } = {}) {
    if (!el || !candidates?.length) return null
    if (prefersReducedMotion()) {
        el.textContent = candidates[0]
        return null
    }
    const tl = gsap.timeline({ repeat: -1 })
    candidates.forEach((word) => {
        tl.set(el, { textContent: word })
            .fromTo(el, { yPercent: 70 }, { yPercent: 0, duration: interval, ease: "power3.out" })
    })
    return tl
}

/* The lead panel prints dark on pale cloth — inversion is how rank is shown,
   so arriving at rank is an inversion that snaps into place. */
export function invertIn(target, { delay = 0 } = {}) {
    if (!target) return null
    if (prefersReducedMotion()) {
        gsap.set(target, { opacity: 1, scaleY: 1 })
        return null
    }
    return gsap.fromTo(
        target,
        { opacity: 0, scaleY: 0.6, transformOrigin: "50% 100%" },
        { opacity: 1, scaleY: 1, duration: 0.5, delay, ease: "back.out(2)" }
    )
}

/* Counting the score up as the panel lands. Tabular numerals hold the width. */
export function countUp(el, value, { duration = 1.1, delay = 0 } = {}) {
    if (!el || typeof value !== "number") return null
    if (prefersReducedMotion()) {
        el.textContent = String(value)
        return null
    }
    const box = { n: 0 }
    return gsap.to(box, {
        n: value,
        duration,
        delay,
        ease: "power2.out",
        onUpdate: () => {
            el.textContent = String(Math.round(box.n))
        },
    })
}
