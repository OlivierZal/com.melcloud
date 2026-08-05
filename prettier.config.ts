import type { Config } from 'prettier'

const config: Config = {
  objectWrap: 'collapse',
  plugins: ['prettier-plugin-packagejson'],
  semi: false,
  singleQuote: true,
}

export default config
