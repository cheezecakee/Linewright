import { describe, expect, test } from "bun:test";
import { vec3, add, sub, scale, dot, length } from "../../../src/core/math/vec3";

describe("vec3", () => {
  test("builds a vector from its components", () => {
    expect(vec3(1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe("add", () => {
  test("adds component by component", () => {
    expect(add(vec3(1, 2, 3), vec3(4, 5, 6))).toEqual(vec3(5, 7, 9));
  });

  test("does not change its inputs", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(1, 1, 1);
    add(a, b);
    expect(a).toEqual(vec3(1, 2, 3));
    expect(b).toEqual(vec3(1, 1, 1));
  });
});

describe("sub", () => {
  test("b - a is the vector from point a to point b", () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 6, 8);
    expect(sub(b, a)).toEqual(vec3(3, 4, 5));
  });

  test("a - a is the zero vector", () => {
    const a = vec3(7, 8, 9);
    expect(sub(a, a)).toEqual(vec3(0, 0, 0));
  });
});

describe("scale", () => {
  test("multiplies every component", () => {
    expect(scale(vec3(1, -2, 3), 2)).toEqual(vec3(2, -4, 6));
  });

  test("scaling by 0 gives the zero vector", () => {
    expect(scale(vec3(1, 2, 3), 0)).toEqual(vec3(0, 0, 0));
  });
});

describe("dot", () => {
  test("sums the products of the components", () => {
    expect(dot(vec3(1, 2, 3), vec3(4, 5, 6))).toBe(32);
  });

  test("is 0 for perpendicular vectors", () => {
    expect(dot(vec3(1, 0, 0), vec3(0, 1, 0))).toBe(0);
    expect(dot(vec3(2, 3, 0), vec3(-3, 2, 0))).toBe(0);
  });

  test("dot(a, a) is the length squared", () => {
    const a = vec3(1, 2, 2);
    expect(dot(a, a)).toBe(9);
  });
});

describe("length", () => {
  test("3-4-5 triangle", () => {
    expect(length(vec3(3, 4, 0))).toBe(5);
  });

  test("works in 3D", () => {
    expect(length(vec3(1, 2, 2))).toBe(3);
    expect(length(vec3(1, 1, 1))).toBeCloseTo(Math.sqrt(3), 12);
  });

  test("the zero vector has length 0", () => {
    expect(length(vec3(0, 0, 0))).toBe(0);
  });
});
