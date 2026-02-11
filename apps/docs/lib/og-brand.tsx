import { LOGO_PATHS, LOGO_VIEWBOX } from '../../../assets/brand'

export { LOGO_VIEWBOX, LOGO_PATHS }

export function LogoSvg({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={LOGO_VIEWBOX} fill="none">
      {LOGO_PATHS.map((p, i) => (
        <path key={i} fill={p.fill} d={p.d} />
      ))}
    </svg>
  )
}
