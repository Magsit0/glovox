import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // docs/ es carpeta local de análisis (gitignored): ESLint no lee .gitignore.
    "docs/**",
  ]),
  // Scripts CommonJS que corren con `node` directo (no pasan por el bundler de
  // Next): ahí `require()` es la forma correcta, no un import mal escrito.
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // router.push/replace tienen que pasar por lib/use-router.ts para que aparezca
  // el feedback de navegación (barra + spinner). Ver components/NavigationFeedback.tsx.
  {
    ignores: ["lib/use-router.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/navigation",
              importNames: ["useRouter"],
              message:
                'Importa useRouter desde "@/lib/use-router": muestra el feedback de carga al navegar.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
