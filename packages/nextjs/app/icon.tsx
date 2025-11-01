import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 180 180"
          xmlns="http://www.w3.org/2000/svg"
        >
          <mask id="mask" x="0" y="0" width="180" height="180">
            <rect fill="white" width="180" height="180" rx="90" />
          </mask>
          <g mask="url(#mask)">
            <rect fill="black" width="180" height="180" />
            <path
              fill="white"
              d="M48 48h84v84H48z"
            />
            <circle
              fill="black"
              cx="90"
              cy="90"
              r="20"
            />
          </g>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
