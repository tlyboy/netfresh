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
    // Keep components pulled from shadcn as-is; don't change them just to satisfy lint.
    // ui/** Exporting buttonVariants and exporting useTheme from theme-provider are both standard shadcn patterns,
    // and will trigger react-refresh/only-export-components; this rule only affects HMR granularity and isn't a defect.
    files: ['src/components/ui/**', 'src/components/theme-provider.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
