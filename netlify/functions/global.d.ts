/** Minimal ambient declaration so this package can typecheck without @types/node (Netlify's Node runtime provides `process` at runtime). */
declare const process: {
  env: Record<string, string | undefined>;
};
