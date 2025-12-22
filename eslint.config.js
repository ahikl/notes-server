import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	eslintConfigPrettier,
	{
		ignores: ['node_modules/**', '.wrangler/**', 'dist/**', '.husky/**', '.idea/**', '*.sql'],
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: true,
			},
		},
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'prefer-const': 'error',
			eqeqeq: ['error', 'always'],
		},
	},
);
