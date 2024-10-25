import daisyui from 'daisyui'

import type { Config } from 'tailwindcss'

const config = {
  content: ['./widgets/**/public/index.{html,ts,mts}'],
  plugins: [daisyui],
  theme: {
    extend: {},
  },
} satisfies Config

export default config
