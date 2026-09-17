"""Geometry validation shared with the isolated plan worker (no HA imports)."""
import math

# A side bent enough to be an arc; below it is a straight wall. `arcs` holds one bend per side (side i runs from
# corner i to corner i + 1): the height of its arc over half the side's length, towards (-dy, dx) when positive.
ARC_MIN = 1e-3
# Largest turn between two points of a curved wall as drawn, as in the browser: a half circle takes 24 pieces.
ARC_STEP = math.pi / 24


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def bent(bulge):
    """Whether this side is curved."""
    return _number(bulge) and abs(bulge) >= ARC_MIN


def arc_circle(a, b, bulge):
    """Centre, radius, angle of `a` and signed sweep to `b` of the side bent by `bulge`; None when it is straight."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    if not bent(bulge) or length < 1e-9:
        return None
    half = length / 2
    sagitta = bulge * half
    radius = (half * half + sagitta * sagitta) / (2 * abs(sagitta))
    shift = sagitta - math.copysign(radius, sagitta)
    center = ((a[0] + b[0]) / 2 - dy / length * shift, (a[1] + b[1]) / 2 + dx / length * shift)
    return center, radius, math.atan2(a[1] - center[1], a[0] - center[0]), -4 * math.atan(bulge)


def arc_points(a, b, bulge, step=ARC_STEP, min_length=.02):
    """Points of a curved side strictly between its ends, as the browser draws them (same count)."""
    arc = arc_circle(a, b, bulge)
    if not arc:
        return []
    center, radius, start, sweep = arc
    turn = abs(sweep)
    count = max(2, min(math.ceil(turn / step - 1e-9), int(radius * turn / min_length)))
    return [[center[0] + radius * math.cos(start + sweep * k / count), center[1] + radius * math.sin(start + sweep * k / count)]
            for k in range(1, count)]


def side_point(a, b, bulge, t):
    """Point at `t` (0 at `a`, 1 at `b`) along a side, straight or curved."""
    arc = arc_circle(a, b, bulge)
    if not arc:
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    center, radius, start, sweep = arc
    return [center[0] + radius * math.cos(start + sweep * t), center[1] + radius * math.sin(start + sweep * t)]


def bend(arcs, index):
    """Bend of side `index`, 0 without one."""
    return arcs[index] if arcs and index < len(arcs) and _number(arcs[index]) else 0


def outline(points, arcs=None, step=ARC_STEP, min_length=.02):
    """The outline as drawn, every curved side replaced by its pieces."""
    if not arcs or not any(bent(b) for b in arcs if _number(b)):
        return [list(p) for p in points]
    ring = []
    for i, a in enumerate(points):
        ring.append(list(a))
        ring += arc_points(a, points[(i + 1) % len(points)], bend(arcs, i), step, min_length)
    return ring


def ring_area(points, arcs=None):
    """Surface of a ring, curved sides counted exactly."""
    signed = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(points, points[1:] + points[:1])) / 2
    for i, a in enumerate(points):
        arc = arc_circle(a, points[(i + 1) % len(points)], bend(arcs, i))
        if arc:
            turn = abs(arc[3])
            signed -= math.copysign(1, arcs[i]) * arc[1] ** 2 / 2 * (turn - math.sin(turn))
    return abs(signed)


def _cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def _on(a, b, c):
    return abs(_cross(a, b, c)) < 1e-8 and all(min(a[i], b[i])-1e-8 <= c[i] <= max(a[i], b[i])+1e-8 for i in (0, 1))


def _intersects(a, b, c, d):
    return (_cross(a, b, c)*_cross(a, b, d) < 0 and _cross(c, d, a)*_cross(c, d, b) < 0) or _on(a, b, c) or _on(a, b, d) or _on(c, d, a) or _on(c, d, b)


def valid_ring(points, arcs=None):
    """Simple ring of at least 5 dm², without null edges or crossings; `arcs` bends its sides, a half circle at most."""
    if arcs is not None and (len(arcs) != len(points) or not all(_number(b) and abs(b) <= 1 for b in arcs)):
        return False
    if len(points) < 3 or not all(math.isfinite(v) for p in points for v in p):
        return False
    points = outline(points, arcs)
    area = abs(sum(p[0]*points[(i+1) % len(points)][1]-points[(i+1) % len(points)][0]*p[1] for i, p in enumerate(points)))/2
    if area < .05:
        return False
    for i, a in enumerate(points):
        b = points[(i+1) % len(points)]
        if math.dist(a, b) < .01:
            return False
        for j in range(i+1, len(points)):
            if j == i+1 or (i == 0 and j == len(points)-1):
                continue
            if _intersects(a, b, points[j], points[(j+1) % len(points)]):
                return False
    return True


def validate_geometry(plan):
    """Call after JSON Schema validation. Reject duplicate IDs and invalid rings."""
    floors = set()
    for floor in plan["floors"]:
        if floor["id"] in floors or not all(math.isfinite(floor[k]) for k in ("height", "elevation")):
            raise ValueError("invalid_geometry")
        floors.add(floor["id"])
        rooms = set()
        for room in floor["rooms"]:
            if room["id"] in rooms or not valid_ring(room["polygon"], room.get("arcs")):
                raise ValueError("invalid_geometry")
            rooms.add(room["id"])
