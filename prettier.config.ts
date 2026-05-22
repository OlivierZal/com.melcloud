import type { Config } from 'prettier'

const config: Config = {
  experimentalTernaries: true,
  plugins: ['prettier-plugin-packagejson'],
  semi: false,
  singleQuote: true,
}

export default config
