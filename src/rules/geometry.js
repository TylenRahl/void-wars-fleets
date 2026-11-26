// Points, angles and circles on the table, in centimetres (all distances are in centimetres).
// Exports small pure helpers (rad, deg, dist, along, angleTo, arcs and circle tests) used by almost every rules file
// and by the battle screen.
//
// The table: x across, y down, both in cm. A facing is an angle in degrees: 0 points along +x and angles grow
// towards +y, so a positive turn is clockwise as seen from above. A ship's port (left) side is anticlockwise
// of its facing, starboard (right) clockwise.

export const rad = deg => deg * Math.PI / 180
export const deg = r => r * 180 / Math.PI
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
export const dir = facing => ({ x: Math.cos(rad(facing)), y: Math.sin(rad(facing)) })
export const along = (p, facing, d) => ({ x: p.x + Math.cos(rad(facing)) * d, y: p.y + Math.sin(rad(facing)) * d })
export const angleTo = (a, b) => deg(Math.atan2(b.y - a.y, b.x - a.x))
/** Normalise an angle to (-180, 180]. */
export function norm (a) {
  let x = ((a % 360) + 360) % 360
  if (x > 180) x -= 360
  return x
}
const EPS = 1e-6

/**
 * The fire arcs of a ship at `pos` facing `facing` that contain point `p`: four 90° quarters,
 * front, right, rear, left. A point exactly on a boundary is in both arcs (the shooter chooses).
 */
export function arcsContaining (pos, facing, p) {
  if (Math.abs(p.x - pos.x) < EPS && Math.abs(p.y - pos.y) < EPS) return ['front', 'right', 'rear', 'left']
  const r = norm(angleTo(pos, p) - facing)
  const out = []
  if (Math.abs(r) <= 45 + EPS) out.push('front')
  if (r >= 45 - EPS && r <= 135 + EPS) out.push('right')
  if (Math.abs(r) >= 135 - EPS) out.push('rear')
  if (r <= -45 + EPS && r >= -135 - EPS) out.push('left')
  return out
}

/** The shortest distance from point p to the segment a-b. */
export function segPointDist (a, b, p) {
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2)) : 0
  return Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)
}

/**
 * The first point along a-b at which a circle of radius r moving from a to b touches the circle (c, R), as a
 * fraction 0..1 of the way, or null if it never does. Already touching at a gives 0.
 */
export function firstContact (a, b, r, c, R) {
  const rr = r + R
  const fx = a.x - c.x, fy = a.y - c.y
  if (fx * fx + fy * fy <= rr * rr + EPS) return 0
  const dx = b.x - a.x, dy = b.y - a.y
  const A = dx * dx + dy * dy
  if (A < EPS) return null
  const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - rr * rr
  const disc = B * B - 4 * A * C
  if (disc < 0) return null
  const t = (-B - Math.sqrt(disc)) / (2 * A)
  return t >= -EPS && t <= 1 + EPS ? Math.max(0, t) : null
}

export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
