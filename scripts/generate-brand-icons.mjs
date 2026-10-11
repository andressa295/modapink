// Render the existing MP monogram into standard browser icon formats.
// Uses the original logo pixels; the source artwork is never modified.
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import React from "react"
import { ImageResponse } from "next/og.js"

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const logo = await fs.readFile(path.join(root, "public/modapiink.png"))
  const source = `data:image/png;base64,${logo.toString("base64")}`
  const png = async size => {
    const scale = size * 108 / 128 / 350
    const element = React.createElement("div", {
      style: { width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "white", borderRadius: size * 24 / 128 },
    }, React.createElement("div", {
      style: { position: "relative", display: "flex", width: size * 108 / 128, height: size * 74 / 128, overflow: "hidden" },
    }, React.createElement("img", {
      src: source,
      width: 820 * scale,
      height: 503 * scale,
      style: { position: "absolute", left: -245 * scale, top: -35 * scale, width: 820 * scale, height: 503 * scale },
    })))
    return Buffer.from(await new ImageResponse(element, { width: size, height: size }).arrayBuffer())
  }

  const sizes = [16, 32, 48, 64, 128]
  const images = await Promise.all(sizes.map(png))
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  images.forEach((image, index) => {
    const entry = 6 + index * 16
    header[entry] = sizes[index]
    header[entry + 1] = sizes[index]
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  await fs.writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([header, ...images]))
  await fs.writeFile(path.join(root, "app/apple-icon.png"), await png(180))
  console.log("Favicon MP: 16, 32, 48, 64 e 128px; ícone Apple: 180px.")
}

main().catch(error => { console.error(error); process.exitCode = 1 })
