import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        // TypeScript/VS Code globals
        Thenable: "readonly",
        NodeJS: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off", // Allow any for VS Code API compatibility
      "no-unused-vars": "off",
      "no-undef": "off", // TypeScript handles this
    },
  },
  {
    ignores: ["out/**", "node_modules/**", "*.js", "*.mjs"],
  },
];
