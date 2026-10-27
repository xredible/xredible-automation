// lib/printables/shapes.ts
//
// Cut-out templates for printables: simple outlines in a 100×100 box (SVG paths, y down).
// They are drawn with a dashed line so children can cut along it.

const r = (n: number) => Math.round(n * 10) / 10

function star(points: number, outer: number, inner: number): string {
  let d = ""
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const rad = i % 2 ? inner : outer
    d += `${i ? "L" : "M"}${r(50 + rad * Math.cos(a))} ${r(52 + rad * Math.sin(a))}`
  }
  return d + "Z"
}

function petals(n: number, len: number, wide: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n
    const p = (x: number, y: number) => `${r(50 + x * Math.cos(a) - y * Math.sin(a))} ${r(50 + x * Math.sin(a) + y * Math.cos(a))}`
    out.push(`M${p(10, 0)}C${p(18, -wide)} ${p(len - 6, -wide)} ${p(len, 0)}C${p(len - 6, wide)} ${p(18, wide)} ${p(10, 0)}Z`)
  }
  return out
}

const circle = (cx: number, cy: number, rad: number) => `M${cx - rad} ${cy}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0Z`

export const SHAPES: Record<string, { label: string; paths: string[] }> = {
  circle: { label: "Circle", paths: [circle(50, 50, 46)] },
  square: { label: "Square", paths: ["M14 6h72a8 8 0 0 1 8 8v72a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8Z"] },
  triangle: { label: "Triangle", paths: ["M50 6 L95 90 H5 Z"] },
  star: { label: "Star", paths: [star(5, 47, 20)] },
  heart: { label: "Heart", paths: ["M50 90C22 70 5 52 5 33 5 18 16 8 30 8c9 0 16 5 20 13 4-8 11-13 20-13 14 0 25 10 25 25 0 19-17 37-45 57Z"] },
  leaf: { label: "Leaf", paths: ["M50 3C79 21 88 52 73 76 65 89 57 94 50 97 43 94 35 89 27 76 12 52 21 21 50 3Z", "M50 20V97"] },
  flower: { label: "Flower (rangoli)", paths: [...petals(8, 46, 11), circle(50, 50, 10)] },
  diya: { label: "Diya", paths: ["M5 58H95C90 80 72 93 50 93S10 80 5 58Z", "M50 8C61 22 65 33 61 43 58 50 54 53 50 53S42 50 39 43C35 33 39 22 50 8Z"] },
  lantern: { label: "Lantern (kandil)", paths: ["M50 4 82 38 50 72 18 38Z", "M18 38H82", "M38 72 34 97M50 72V98M62 72 66 97"] },
  pumpkin: { label: "Pumpkin", paths: ["M50 26C22 26 6 42 6 62s16 32 44 32 44-12 44-32-16-36-44-36Z", "M50 26C38 34 34 48 34 62s4 24 16 32M50 26c12 8 16 22 16 36s-4 24-16 32", "M50 26V12c0-4 3-6 8-6"] },
  apple: { label: "Apple", paths: ["M50 26C40 18 22 18 14 32S8 70 22 84c10 10 20 10 28 5 8 5 18 5 28-5 14-14 16-38 8-52S60 18 50 26Z", "M50 26C50 16 54 8 60 4", "M54 18c6-8 16-10 22-6-4 8-14 10-22 6Z"] },
  egg: { label: "Egg", paths: ["M50 4C27 4 12 40 12 62c0 20 17 34 38 34s38-14 38-34C88 40 73 4 50 4Z"] },
  cloud: { label: "Cloud", paths: ["M26 82C14 82 5 73 5 62s9-20 20-20c1-15 13-26 28-26 12 0 22 7 26 18 10 1 17 9 17 19 0 16-11 29-27 29Z"] },
  sun: { label: "Sun", paths: [circle(50, 50, 22), "M50 6V18M50 82V94M6 50H18M82 50H94M19 19l8 8M73 73l8 8M19 81l8-8M73 27l8-8"] },
  moon: { label: "Moon", paths: ["M62 6C40 10 24 28 24 50s16 40 38 44C40 98 8 84 8 50S40 2 62 6Z"] },
  tree: { label: "Tree", paths: ["M50 4 78 38H64L86 64H70L92 86H8L30 64H14L36 38H22Z", "M44 86H56V98H44Z"] },
  house: { label: "House", paths: ["M50 6 94 44H82V94H18V44H6Z", "M40 94V66H60V94"] },
  hand: { label: "Hand", paths: ["M30 94C18 82 12 66 12 52V38c0-4 3-7 7-7s7 3 7 7v10V18c0-4 3-7 7-7s7 3 7 7v28V12c0-4 3-7 7-7s7 3 7 7v34V20c0-4 3-7 7-7s7 3 7 7v36l6-10c2-4 6-6 10-4s5 7 3 11L78 80c-5 9-13 14-22 14Z"] },
}

export const SHAPE_NAMES = Object.keys(SHAPES)
