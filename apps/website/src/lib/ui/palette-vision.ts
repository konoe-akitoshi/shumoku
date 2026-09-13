import { decodeHex } from './palette-model'

export const visionMatrices = {
  protan: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deutan: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
  grayscale: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
} as const

export type Vision = keyof typeof visionMatrices

export function filterMatrix(vision: Vision) {
  const matrix = visionMatrices[vision]
  return `${[0, 3, 6].map((offset) => `${matrix.slice(offset, offset + 3).join(' ')} 0 0`).join(' ')} 0 0 0 1 0`
}

export function simulateColor(hex: string, vision: Vision) {
  const rgb = decodeHex(hex)
  const matrix = visionMatrices[vision]
  return `#${[0, 3, 6]
    .map((offset) => {
      const linear = Math.max(
        0,
        Math.min(
          1,
          rgb.reduce((sum, value, index) => sum + value * (matrix[offset + index] ?? 0), 0),
        ),
      )
      const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`
}
