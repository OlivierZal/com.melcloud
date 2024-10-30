import daisyui from 'daisyui'

import type { Config } from 'tailwindcss'

const config = {
  content: ['./widgets/**/public/index.{html,ts,mts}'],
  daisyui: {
    themes: false,
  },
  plugins: [daisyui],
  theme: {
    extend: {
      colors: {
        blue: 'var(--homey-color-blue)',
        color: 'var(--homey-text-color)',
        danger: 'var(--homey-text-color-danger)',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      fontSize: {
        default: [
          'var(--homey-font-size-default)',
          'var(--homey-line-height-default)',
        ],
      },
    },
  },
} satisfies Config

export default config
