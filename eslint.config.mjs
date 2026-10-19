
import { defineConfig, globalIgnores } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);

const compat = new FlatCompat({
  baseDirectory: directory,
});

export default defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Cover and story images come from user-uploaded Supabase Storage URLs, which next/image
      // can't optimise without a fixed remote-host list, so plain <img> is intentional here.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
