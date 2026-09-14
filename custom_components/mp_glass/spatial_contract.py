"""Geometry validation shared with the isolated plan worker (no HA imports)."""
import math


def _cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def _on(a, b, c):
    return abs(_cross(a, b, c)) < 1e-8 and all(min(a[i], b[i])-1e-8 <= c[i] <= max(a[i], b[i])+1e-8 for i in (0, 1))


def _intersects(a, b, c, d):
    return (_cross(a, b, c)*_cross(a, b, d) < 0 and _cross(c, d, a)*_cross(c, d, b) < 0) or _on(a, b, c) or _on(a, b, d) or _on(c, d, a) or _on(c, d, b)


def valid_ring(points):
    """Simple ring of at least 5 dm², without null edges or crossings."""
    if len(points) < 3 or not all(math.isfinite(v) for p in points for v in p):
        return False
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
            if room["id"] in rooms or not valid_ring(room["polygon"]):
                raise ValueError("invalid_geometry")
            rooms.add(room["id"])
