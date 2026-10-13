import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url)),root=path.dirname(here);
await viteBuild({configFile:path.join(here,'vite.config.ts')});
await esbuild({entryPoints:[path.join(here,'api.ts')],outfile:path.join(here,'server.cjs'),bundle:true,format:'cjs',platform:'node',target:'node22',
  alias:{'@/lib/server':path.join(here,'server.ts'),'cloudflare:workers':path.join(here,'local-env.ts'),'@':root},
});
console.log('Локальный интерфейс и API собраны.');
