import { describe, expect, test } from "bun:test";
import { vec3, dot, length, cross, normalize } from "../../../src/core/math/vec3";

describe("cross", () => {
  test("x cross y is z", () => {
    expect(cross(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
  });

  test("order matters: y cross x is -z", () => {
    expect(cross(vec3(0, 1, 0), vec3(1, 0, 0))).toEqual(vec3(0, 0, -1));
  });

  test("matches the formula on a general case", () => {
    expect(cross(vec3(1, 2, 3), vec3(4, 5, 6))).toEqual(vec3(-3, 6, -3));
  });

  test("the result is perpendicular to both inputs", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    const c = cross(a, b);
    expect(dot(c, a)).toBe(0);
    expect(dot(c, b)).toBe(0);
  });

  test("a vector crossed with itself is the zero vector", () => {
    expect(cross(vec3(1, 2, 3), vec3(1, 2, 3))).toEqual(vec3(0, 0, 0));
  });
});

describe("normalize", () => {
  test("keeps the direction and makes the length 1", () => {
    const n = normalize(vec3(3, 4, 0));
    expect(n.x).toBeCloseTo(0.6, 12);
    expect(n.y).toBeCloseTo(0.8, 12);
    expect(n.z).toBeCloseTo(0, 12);
    expect(length(n)).toBeCloseTo(1, 12);
  });

  test("works on any direction", () => {
    const n = normalize(vec3(-2, 5, 7));
    expect(length(n)).toBeCloseTo(1, 12);
  });

  test("an already-unit vector stays the same", () => {
    const n = normalize(vec3(0, 1, 0));
    expect(n.x).toBeCloseTo(0, 12);
    expect(n.y).toBeCloseTo(1, 12);
    expect(n.z).toBeCloseTo(0, 12);
  });

  test("the zero vector stays zero instead of becoming NaN", () => {
    const n = normalize(vec3(0, 0, 0));
    expect(n).toEqual(vec3(0, 0, 0));
  });

  test("does not change its input", () => {
    const v = vec3(3, 4, 0);
    normalize(v);
    expect(v).toEqual(vec3(3, 4, 0));
  });
});
