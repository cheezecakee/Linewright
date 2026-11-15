export type Vec3 = {
    x: number;
    y: number;
    z: number;
}

export function vec3(x: number, y: number, z: number): Vec3 {
    return {
        x: x,
        y: y,
        z: z
    }
}

export function add(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
    } 
}

export function sub(b: Vec3, a: Vec3): Vec3 {
    return {
        x: b.x - a.x,
        y: b.y - a.y,
        z: b.z - a.z,
    } 
}

export function scale(v: Vec3, s: number): Vec3 {
    return {
        x: v.x * s,
        y: v.y * s,
        z: v.z * s,
    } 
}

export function dot(a: Vec3, b: Vec3): number {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z)
}

export function length(v: Vec3): number {
    return Math.sqrt((v.x ** 2) + (v.y ** 2) + (v.z ** 2))
}
