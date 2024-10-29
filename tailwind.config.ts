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
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      fontSize: {
        default: ['17px', '24px'],
      },
      fontWeight: {
        regular: '400',
      },
    },
  },
} satisfies Config

export default config
