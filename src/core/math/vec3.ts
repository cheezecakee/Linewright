export type Vec3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

/**
 * Returns a - b.
 * Use it to get an arrow from point a to b: sub(end, start) is the arrow.
 *
 * @example sub(vec3(4, 0, 0), vec3(3, 0, 0)) // { x: 1, y: 0, z: 0 }
 */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scale(v: Vec3, s: number): Vec3 {
  return vec3(v.x * s, v.y * s, v.z * s);
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}
