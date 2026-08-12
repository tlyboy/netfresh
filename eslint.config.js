import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src-tauri/target']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn 拉下来的组件按原样保留，不为了过 lint 去改它们。
    // ui/** 导出 buttonVariants、theme-provider 导出 useTheme，都是 shadcn 的标准写法，
    // 会触发 react-refresh/only-export-components；这条规则只影响 HMR 粒度，不是缺陷。
    files: ['src/components/ui/**', 'src/components/theme-provider.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
