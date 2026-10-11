const CHART_HEIGHT = 180
const LABEL_SPACING = 65

/** Pixel coordinates use the measured viewport width, so SVG circles and text stay proportional. */
export function buildChartGeometry(viewportWidth: number, values: number[]) {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 680
  const height = CHART_HEIGHT
  const top = 14, bottom = 14
  const maximum = Math.max(0, ...values.filter(Number.isFinite))
  const desiredStep = Math.max(1, maximum / 4)
  const magnitude = 10 ** Math.floor(Math.log10(desiredStep))
  const multiplier = [1, 2, 5, 10].find(value => value * magnitude >= desiredStep) || 10
  const step = multiplier * magnitude
  const scale = step * 4
  const tickValues = [4, 3, 2, 1, 0].map(value => value * step)
  const longestLabel = Math.max(...tickValues.map(value => new Intl.NumberFormat("pt-BR").format(value).length))
  const left = Math.min(Math.max(38, longestLabel * 7 + 16), width * .4)
  const right = Math.min(16, width * .08)
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const coordinates = values.map((value, index) => ({
    x: values.length === 1 ? left + plotWidth / 2 : left + index / (values.length - 1) * plotWidth,
    y: top + (1 - Math.max(0, Number.isFinite(value) ? value : 0) / scale) * plotHeight,
  }))
  const points = coordinates.map((point, index) => {
    const hitLeft = index === 0 ? left : (coordinates[index - 1].x + point.x) / 2
    const hitRight = index === coordinates.length - 1 ? width - right : (point.x + coordinates[index + 1].x) / 2
    return { ...point, hitLeft, hitWidth: hitRight - hitLeft }
  })
  const tickCount = Math.min(values.length, Math.max(2, Math.floor(plotWidth / LABEL_SPACING) + 1))
  const xTickIndexes = tickCount === 1 ? [0] : Array.from({ length: tickCount }, (_, index) => Math.round(index * (values.length - 1) / (tickCount - 1)))
  const ticks = tickValues.map((value, index) => ({ value, y: top + index / 4 * plotHeight }))
  return { width, height, left, right, top, bottom, plotWidth, plotHeight, scale, points, ticks, xTickIndexes }
}
