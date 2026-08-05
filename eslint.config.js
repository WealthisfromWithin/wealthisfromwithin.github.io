import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const PROVIDER_BOUNDARY_MESSAGE =
  'Model provider SDKs are forbidden outside src/agents/providers. Route every model call through the Agent Kernel (src/agents).';

/**
 * Architecture rule: no module may import a model provider SDK directly. Packages
 * are listed by exact name where the name is stable and by pattern where vendors
 * publish families of scoped packages.
 */
const PROVIDER_PACKAGES = [
  'openai',
  '@anthropic-ai/sdk',
  '@google/generative-ai',
  '@google/genai',
  'groq-sdk',
  'cohere-ai',
  'replicate',
  'together-ai',
  'ollama',
  '@azure/openai',
  '@huggingface/inference',
  'ai',
  'langchain',
  'llamaindex',
];

const PROVIDER_PACKAGE_PATTERNS = [
  '@anthropic-ai/*',
  '@google-cloud/aiplatform*',
  '@mistralai/*',
  '@ai-sdk/*',
  'ai/*',
  '@langchain/*',
  '@openrouter/*',
  'openrouter*',
  '*openrouter*',
  '@aws-sdk/client-bedrock*',
  '@google/generative-ai/*',
  'openai/*',
];

const providerImportBoundary = {
  paths: PROVIDER_PACKAGES.map((name) => ({ name, message: PROVIDER_BOUNDARY_MESSAGE })),
  patterns: [{ group: PROVIDER_PACKAGE_PATTERNS, message: PROVIDER_BOUNDARY_MESSAGE }],
};

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': ['error', providerImportBoundary],
    },
  },
  {
    // The single sanctioned home for provider adapters. Empty in Wave 1: the boundary
    // exists so the first adapter has one legal location instead of leaking into UI.
    files: ['src/agents/providers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // UI layers talk to the kernel, never to an adapter.
    files: ['src/app/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...providerImportBoundary,
          patterns: [
            ...providerImportBoundary.patterns,
            {
              group: ['@/agents/providers/*', '**/agents/providers/*'],
              message: 'UI must use the Agent Kernel (@/agents), not a provider adapter.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
);
