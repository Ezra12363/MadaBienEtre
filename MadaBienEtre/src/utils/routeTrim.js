// src/utils/routeTrim.js
// ============================================================
// ✅ Outils "route suivie" :
//
// projectOnRoute(coords, pos)
//   -> segment de la route le plus proche de `pos` + point PROJETÉ sur la
//      route (le marqueur peut ainsi "rouler" exactement sur la ligne).
//
// trimRouteFromPosition(coords, pos, { maxOffKm, snapKm })
//   -> [point de départ, ...points restants] : retire la partie déjà
//      parcourue. Si `pos` est à <= snapKm de la route, la ligne démarre
//      sur le point projeté (collée à la route), sinon sur `pos`.
//      Si `pos` est à > maxOffKm de la route (hors itinéraire), le tracé
//      est renvoyé inchangé en attendant le recalcul.
// ============================================================

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG_EQ = 111.32;

export const projectOnRoute = (coords, pos) => {
  if (!Array.isArray(coords) || coords.length < 2 || !pos) return null;

  const kx = KM_PER_DEG_LNG_EQ * Math.cos((pos.latitude * Math.PI) / 180);
  const toXY = (p) => ({ x: p.longitude * kx, y: p.latitude * KM_PER_DEG_LAT });

  const P = toXY(pos);
  let best = null;

  let A = toXY(coords[0]);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const B = toXY(coords[i + 1]);

    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq === 0 ? 0 : ((P.x - A.x) * abx + (P.y - A.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const dx = P.x - (A.x + abx * t);
    const dy = P.y - (A.y + aby * t);
    const d = Math.sqrt(dx * dx + dy * dy);

    if (!best || d < best.distanceKm) {
      best = { index: i, t, distanceKm: d };
    }
    A = B;
  }

  if (!best) return null;

  const a = coords[best.index];
  const b = coords[best.index + 1];
  return {
    index: best.index,
    distanceKm: best.distanceKm,
    point: {
      latitude: a.latitude + (b.latitude - a.latitude) * best.t,
      longitude: a.longitude + (b.longitude - a.longitude) * best.t,
    },
  };
};

export const trimRouteFromPosition = (
  coords,
  pos,
  { maxOffKm = 0.2, snapKm = 0.019 } = {}
) => {
  const proj = projectOnRoute(coords, pos);
  if (!proj || proj.distanceKm > maxOffKm) return coords;

  const start =
    proj.distanceKm <= snapKm
      ? proj.point
      : { latitude: pos.latitude, longitude: pos.longitude };

  const rest = coords.slice(proj.index + 1);
  return [start, ...(rest.length ? rest : [coords[coords.length - 1]])];
};

export default trimRouteFromPosition;