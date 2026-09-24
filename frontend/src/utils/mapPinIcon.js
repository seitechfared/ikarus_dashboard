import { getThemeColors } from '@/utils/theme'

const buildMapPinSvg = (primary, secondary) => `<svg width="43" height="55" viewBox="0 0 43 55" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M42.0474 22C42.0474 42.9499 21.0237 55 21.0237 55C21.0237 55 0 42.9499 0 22C0 16.1652 2.21499 10.5695 6.15769 6.44365C10.1004 2.31785 15.4479 0 21.0237 0C26.5995 0 31.947 2.31785 35.8897 6.44365C39.8324 10.5695 42.0474 16.1652 42.0474 22Z" fill="${primary}"/>
<g transform="translate(5.05 5.28)">
<path d="M31.9542 16.7191C31.9542 21.1532 30.2709 25.4058 27.2746 28.5412C24.2783 31.6767 20.2145 33.4381 15.9771 33.4381C11.7397 33.4381 7.67587 31.6767 4.67958 28.5412C1.68329 25.4058 0 21.1532 0 16.7191C0 12.2849 1.68329 8.03233 4.67958 4.8969C7.67587 1.76147 11.7397 0 15.9771 0C20.2145 0 24.2783 1.76147 27.2746 4.8969C30.2709 8.03233 31.9542 12.2849 31.9542 16.7191Z" fill="white"/>
</g>
<g transform="translate(9 11)">
<path d="M17.4484 3.31641L15.3126 9.72266L19.6789 10.5166L19.8185 10.5518C20.1352 10.658 20.3818 10.9177 20.4679 11.2471C20.5662 11.6235 20.4367 12.0227 20.1369 12.2705L8.63686 21.7705L8.35952 22H6.11245L6.5519 20.6836L8.68667 14.2764L4.32143 13.4834C3.93883 13.4138 3.6307 13.1292 3.53237 12.7529C3.43416 12.3766 3.56364 11.9773 3.86342 11.7295L15.3634 2.22949L15.6408 2H17.8878L17.4484 3.31641ZM6.79409 11.9004L10.1789 12.5166L11.3136 12.7227L10.9484 13.8164L9.36049 18.5791L17.2052 12.0986L13.8214 11.4834L12.6867 11.2773L13.0519 10.1836L14.6388 5.41992L6.79409 11.9004Z" fill="${secondary}"/>
</g>
</svg>`

const buildMapPinDataUri = () => {
  const { primary, secondary } = getThemeColors()
  const svg = buildMapPinSvg(primary, secondary)
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const MAP_PIN_SIZE = { width: 42.05, height: 55 }
export const MAP_PIN_ANCHOR = { x: MAP_PIN_SIZE.width / 2, y: MAP_PIN_SIZE.height }

export const createMapPinIcon = (googleMaps) => {
  const dataUri = buildMapPinDataUri()
  if (!googleMaps) {
    return {
      url: dataUri,
    }
  }

  return {
    url: dataUri,
    scaledSize: new googleMaps.Size(MAP_PIN_SIZE.width, MAP_PIN_SIZE.height),
    anchor: new googleMaps.Point(MAP_PIN_ANCHOR.x, MAP_PIN_ANCHOR.y),
  }
}

export const mapPinIconUrl = () => buildMapPinDataUri()
