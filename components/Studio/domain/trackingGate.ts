// AR only: if world tracking never reaches NORMAL (feature-poor room, covered
// camera), reveal content anyway after this window so it is never withheld
// indefinitely. Tunable; most sessions reach NORMAL within ~1-3s.
export const TRACKING_GATE_FALLBACK_MS = 6000;
