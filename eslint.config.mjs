import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores, } from "eslint/config";


export default defineConfig([
  { files: ["scripts/**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["scripts/**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["scripts/**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.node } },
  globalIgnores(["scripts/wikipedia_dic.js"])
]);
