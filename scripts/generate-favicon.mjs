import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')

const BG = [16, 20, 24, 255]
const INK = [244, 239, 230, 255]
const ACCENT = [232, 93, 76, 255]

/** @param {number} size */
function drawIcon(size) {
  const px = new Uint8ClampedArray(size * size * 4)
  const scale = size / 32

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const sx = x / scale
      const sy = y / scale

      set(px, i, BG)

      if (outsideRoundedRect(sx, sy)) continue

      if (inLetterG(sx, sy)) {
        set(px, i, INK)
        continue
      }
      if (inAccentBar(sx, sy)) {
        set(px, i, ACCENT)
      }
    }
  }

  return px
}

/** @param {Uint8ClampedArray} px @param {number} i @param {number[]} color */
function set(px, i, color) {
  px[i] = color[0]
  px[i + 1] = color[1]
  px[i + 2] = color[2]
  px[i + 3] = 255
}

function outsideRoundedRect(x, y, size = 32, radius = 7) {
  if (x < 0 || y < 0 || x >= size || y >= size) return true
  const corners = [
    [radius, radius],
    [size - radius, radius],
    [radius, size - radius],
    [size - radius, size - radius],
  ]
  for (const [cx, cy] of corners) {
    const inCornerX = cx === radius ? x < radius : x > size - radius
    const inCornerY = cy === radius ? y < radius : y > size - radius
    if (!inCornerX || !inCornerY) continue
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy > radius * radius) return true
  }
  return false
}

function inAccentBar(x, y) {
  return x >= 10 && x <= 22 && y >= 22.5 && y <= 24.7
}

function inLetterG(x, y) {
  const bitmap = [
    '00111111100',
    '01100000110',
    '11000000011',
    '10000000001',
    '10000111111',
    '10001000001',
    '10000001111',
    '10000000001',
    '11000000011',
    '01100000110',
    '00111111100',
  ]
  const col = Math.floor(x - 10)
  const row = Math.floor(y - 9)
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const c = col + dx
      const r = row + dy
      if (r < 0 || r >= bitmap.length || c < 0 || c >= bitmap[0].length) continue
      if (bitmap[r][c] === '1') return true
    }
  }
  return false
}

/** @param {number} width @param {number} height @param {Uint8ClampedArray} rgba */
function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, rowStart + 1)
  }

  const compressed = deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

/** @param {Buffer} buf */
function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** @param {number} size */
function scaleIcon(size) {
  const base = drawIcon(32)
  if (size === 32) return base
  const out = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(31, Math.floor((x / size) * 32))
      const sy = Math.min(31, Math.floor((y / size) * 32))
      const si = (sy * 32 + sx) * 4
      const di = (y * size + x) * 4
      out[di] = base[si]
      out[di + 1] = base[si + 1]
      out[di + 2] = base[si + 2]
      out[di + 3] = base[si + 3]
    }
  }
  return out
}

function writePng(path, size) {
  writeFileSync(path, encodePng(size, size, scaleIcon(size)))
}

function writeIco(path) {
  const png32 = encodePng(32, 32, scaleIcon(32))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)

  const entry = Buffer.alloc(16)
  entry[0] = 32
  entry[1] = 32
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png32.length, 8)
  entry.writeUInt32LE(22, 12)

  writeFileSync(path, Buffer.concat([header, entry, png32]))
}

writePng(join(publicDir, 'favicon-32x32.png'), 32)
writePng(join(publicDir, 'apple-touch-icon.png'), 180)
writeIco(join(publicDir, 'favicon.ico'))
