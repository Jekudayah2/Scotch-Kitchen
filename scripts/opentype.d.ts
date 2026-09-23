// Minimal types for the parts of opentype.js used by scripts/build-logo.ts
// (the package ships no declarations).
declare module 'opentype.js' {
  namespace opentype {
    type PathCommand =
      | { type: 'M' | 'L'; x: number; y: number }
      | { type: 'Q'; x1: number; y1: number; x: number; y: number }
      | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
      | { type: 'Z' }
    interface BoundingBox {
      x1: number
      y1: number
      x2: number
      y2: number
    }
    interface Path {
      commands: PathCommand[]
      getBoundingBox(): BoundingBox
    }
    interface Glyph {
      advanceWidth?: number
      getPath(x: number, y: number, fontSize: number): Path
    }
    interface Font {
      unitsPerEm: number
      charToGlyph(char: string): Glyph
    }
    function parse(buffer: ArrayBufferLike): Font
  }
  export default opentype
}
