import { LOGO_PATHS, LOGO_VIEWBOX } from '../../../assets/brand'

export function LogoSvg({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={LOGO_VIEWBOX} fill="none">
      {LOGO_PATHS.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: this is static and won't re-render, needs refactoring cause logo definition is messed up
        <path key={i} fill={p.fill} d={p.d} />
      ))}
    </svg>
  )
}
