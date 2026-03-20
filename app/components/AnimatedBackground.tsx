"use client"

import Particles from "@tsparticles/react"
import { useEffect, useState } from "react"
import { loadSlim } from "tsparticles-slim"

export default function AnimatedBackground() {
  const [init, setInit] = useState(false)

  useEffect(() => {
    loadSlim().then(() => {
      setInit(true)
    })
  }, [])

  if (!init) return null

  return (
    <Particles
      id="tsparticles"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0
      }}
      options={{
        background: {
          color: "#000"
        },
        particles: {
          number: {
            value: 80
          },
          color: {
            value: "#ff1493"
          },
          links: {
            enable: true,
            color: "#ff1493",
            distance: 130,
            opacity: 0.2
          },
          move: {
            enable: true,
            speed: 0.6
          },
          size: {
            value: { min: 1, max: 3 }
          },
          opacity: {
            value: 0.6
          }
        }
      }}
    />
  )
}