#!/usr/bin/env node
/**
 * Publica `main` en producción de punta a punta: `npm run ship`.
 *
 * Por qué existe: el deploy depende de que GitHub acepte el push Y de que le
 * avise a Vercel. Las dos cosas fallan de forma intermitente cuando GitHub
 * tiene incidentes de "Git Operations" o "Webhooks" (2026-10-07, 10-28, 11-04,
 * 11-05, cruzado con githubstatus.com):
 *  - el push vuelve con "remote rejected … fatal error", HTTP 5xx, etc.;
 *  - el push entra, pero GitHub no le avisa a Vercel y no se crea el deploy.
 * Ninguna de las dos depende del repo. Por eso aquí no se confía en que todo
 * salió bien: se reintenta, se verifica y, si hace falta, se le pide el deploy
 * a Vercel directamente, sin pasar por el aviso de GitHub.
 *
 * Qué hace:
 *  1. Verifica que el CLI de Vercel tenga sesión (sin ella no se puede
 *     comprobar el deploy) y corre `check:deploy`: si falla, no publica.
 *  2. `git fetch`: si origin/main trae commits que no están aquí, se detiene
 *     (no rebasea solo: varias sesiones trabajan en este mismo checkout).
 *  3. `git push` con reintentos, SOLO ante errores transitorios del servidor.
 *     Un rechazo real (non-fast-forward, permisos) corta de inmediato.
 *  4. Espera hasta 2 min a que Vercel registre el deploy de producción de ESE
 *     commit. Si no aparece, GitHub no le avisó: crea el deploy por la API de
 *     Vercel con el commit exacto (lo mismo que "Create Deployment" en el
 *     panel). Vercel baja el código de GitHub; no hace falta otro push.
 *  5. Espera a que el build termine y sale con código ≠ 0 si producción no
 *     quedó con este commit.
 *
 * Opciones:
 *   --dry-run   no pushea ni crea deploys: dice qué haría.
 *   --sha <x>   verifica (y crea si falta) el deploy de ese commit, que ya
 *               debe estar en origin/main. Sirve para destrabar un push hecho
 *               por otra vía. No pushea.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const shaArg = args.includes("--sha") ? args[args.indexOf("--sha") + 1] : null;

const ESPERA_REGISTRO_MS = 2 * 60_000;
const ESPERA_BUILD_MS = 20 * 60_000;
const SONDEO_MS = 10_000;
// Segundos entre intentos de push: 7 intentos repartidos en ~7 min.
const REINTENTOS_PUSH = [10, 20, 40, 60, 120, 180];

// Errores del lado de GitHub (o de la red) que se arreglan reintentando. Todo lo
// demás corta, incluido un 403 de permisos ("unable to access … error: 403").
const TRANSITORIO =
  /fatal error in|Internal Server Error|HTTP 5\d\d|returned error: 5\d\d|HTTP\/2 stream \d+ was not closed cleanly|unexpected disconnect|early EOF|Could not resolve host|Connection (timed out|reset)|Operation timed out/i;
const NO_FAST_FORWARD = /non-fast-forward|fetch first|\[rejected\]/i;

const { projectId, orgId } = JSON.parse(readFileSync(".vercel/project.json", "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[ship] ${msg}`);

function run(cmd, cmdArgs, { allowFail = false, input, env } = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    input,
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (r.error) throw r.error;
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} falló:\n${out.trim()}`);
  }
  return { ok: r.status === 0, out, stdout: r.stdout ?? "" };
}

const git = (...a) => run("git", a).out.trim();

// El CLI global si está; si no, el de npx.
let vercelCmd = ["vercel"];
function vercel(cmdArgs, opts) {
  try {
    return run(vercelCmd[0], [...vercelCmd.slice(1), ...cmdArgs], { ...opts, allowFail: true });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    vercelCmd = ["npx", "--yes", "vercel"];
    return run(vercelCmd[0], [...vercelCmd.slice(1), ...cmdArgs], { ...opts, allowFail: true });
  }
}

/** Llamada a la API de Vercel con la sesión del CLI. Lanza si responde con error. */
function api(path, { method = "GET", body } = {}) {
  const url = `${path}${path.includes("?") ? "&" : "?"}teamId=${orgId}`;
  const a = ["api", url, "--raw"];
  if (method !== "GET") a.push("-X", method);
  if (body) a.push("--input", "-");
  const r = vercel(a, { input: body ? JSON.stringify(body) : undefined });
  const i = r.stdout.indexOf("{");
  let json = null;
  if (i >= 0) {
    try {
      json = JSON.parse(r.stdout.slice(i));
    } catch {
      // queda null: se reporta abajo
    }
  }
  if (!r.ok || !json || json.error) {
    const detalle =
      json?.error?.message ??
      r.out
        .replace(/<claude-code-hint[^>]*\/>/g, "")
        .trim()
        .split("\n")
        .slice(-3)
        .join(" ");
    throw new Error(`API de Vercel ${method} ${path}: ${detalle}`);
  }
  return json;
}

const estado = (d) => d.readyState ?? d.state;
const idDe = (d) => d.uid ?? d.id;
const EN_CURSO = new Set(["QUEUED", "INITIALIZING", "BUILDING"]);

/** El deploy de producción de ese commit: READY, si no uno en curso, si no uno fallido; o null. */
function deployDe(sha) {
  const { deployments = [] } = api(
    `/v6/deployments?projectId=${projectId}&sha=${sha}&target=production&limit=20`,
  );
  return (
    deployments.find((d) => estado(d) === "READY") ??
    deployments.find((d) => EN_CURSO.has(estado(d))) ??
    deployments.find((d) => estado(d) === "ERROR") ??
    null
  );
}

async function esperarRegistro(sha) {
  const hasta = Date.now() + ESPERA_REGISTRO_MS;
  for (;;) {
    try {
      const d = deployDe(sha);
      if (d) return d;
    } catch (e) {
      log(`no pude consultar Vercel (${e.message}); reintento`);
    }
    if (Date.now() >= hasta) return null;
    await sleep(SONDEO_MS);
  }
}

/**
 * Espera el build de producción de `sha`. Si hay más de un deploy de ese commit
 * (el forzado y un aviso atrasado de GitHub, cuando Vercel tiene demoras), vale
 * el primero que quede READY.
 */
async function esperarBuild(sha) {
  const hasta = Date.now() + ESPERA_BUILD_MS;
  let ultimo = null;
  for (;;) {
    try {
      const d = deployDe(sha);
      if (d && !EN_CURSO.has(estado(d))) return api(`/v13/deployments/${idDe(d)}`);
      const e = d ? estado(d) : "sin deploy";
      if (e !== ultimo) log(`build: ${e}`);
      ultimo = e;
    } catch (e) {
      log(`no pude consultar Vercel (${e.message}); reintento`);
    }
    if (Date.now() >= hasta) throw new Error(`El build no terminó en ${ESPERA_BUILD_MS / 60_000} min.`);
    await sleep(SONDEO_MS);
  }
}

async function push() {
  for (let i = 0; ; i++) {
    const r = run("git", ["push", "origin", "main"], { allowFail: true });
    if (r.ok && !/\[rejected\]|remote rejected/.test(r.out)) {
      log(`push OK${i > 0 ? ` (intento ${i + 1})` : ""}`);
      return;
    }
    if (NO_FAST_FORWARD.test(r.out) && !TRANSITORIO.test(r.out)) {
      throw new Error(
        `GitHub rechazó el push porque origin/main avanzó. Corre \`git pull --rebase\` y vuelve a \`npm run ship\`.\n${r.out.trim()}`,
      );
    }
    if (!TRANSITORIO.test(r.out) || i >= REINTENTOS_PUSH.length) {
      throw new Error(`El push falló${i > 0 ? ` tras ${i + 1} intentos` : ""}:\n${r.out.trim()}`);
    }
    const linea = r.out.split("\n").find((l) => TRANSITORIO.test(l))?.trim() ?? "error del servidor";
    log(`GitHub falló (${linea}); reintento en ${REINTENTOS_PUSH[i]} s`);
    await sleep(REINTENTOS_PUSH[i] * 1000);
  }
}

// Fallas de red o del servidor de Vercel al crear el deploy: se reintenta.
// "max retries per request" es un error interno de Vercel (sale como 403) que
// apareció en su incidente del 2026-11-05.
const RED =
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|fetch failed|\(5\d\d\)|max retries per request/i;
const REINTENTOS_API = [15, 30, 60, 120, 180, 300]; // segundos: ~12 min en total

/** Incidentes abiertos en GitHub y Vercel, para decir de quién es la falla. */
async function incidentes() {
  const fuentes = [
    ["GitHub", "https://www.githubstatus.com/api/v2/summary.json"],
    ["Vercel", "https://www.vercel-status.com/api/v2/summary.json"],
  ];
  const lista = [];
  for (const [nombre, url] of fuentes) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      for (const i of (await res.json()).incidents ?? []) lista.push(`${nombre}: ${i.name} (${i.status})`);
    } catch {
      // sin datos de estado: no es crítico
    }
  }
  return lista;
}

/**
 * Crea el deploy con reintentos. Antes de cada reintento revisa si el intento
 * anterior (o un aviso atrasado de GitHub) ya lo creó, para no duplicarlo.
 */
async function forzarDeploy(sha) {
  for (let i = 0; ; i++) {
    try {
      return crearDeploy(sha);
    } catch (e) {
      if (!RED.test(e.message) || i >= REINTENTOS_API.length) throw e;
      log(`Vercel no respondió (${e.message}); reintento en ${REINTENTOS_API[i]} s`);
      await sleep(REINTENTOS_API[i] * 1000);
      try {
        const d = deployDe(sha);
        if (d) return d;
      } catch {
        // se vuelve a intentar crear
      }
    }
  }
}

/** Crea el deploy de producción de `sha` por la API de Vercel, sin depender del aviso de GitHub. */
function crearDeploy(sha) {
  const proyecto = api(`/v9/projects/${projectId}`);
  const link = proyecto.link;
  if (link?.type !== "github" || !link.repoId) {
    throw new Error("El proyecto de Vercel no está conectado a GitHub: no puedo crear el deploy desde el commit.");
  }
  if (DRY) {
    log(`(dry-run) crearía el deploy de producción de ${sha.slice(0, 7)} directo en Vercel (${link.org}/${link.repo})`);
    return null;
  }
  return api("/v13/deployments", {
    method: "POST",
    body: {
      name: proyecto.name,
      project: projectId,
      target: "production",
      gitSource: { type: "github", repoId: link.repoId, ref: link.productionBranch ?? "main", sha },
    },
  });
}

async function main() {
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") {
    throw new Error("No estás en main: este comando publica main.");
  }
  if (!vercel(["whoami"]).ok) {
    throw new Error("El CLI de Vercel no tiene sesión: corre `vercel login` y vuelve a `npm run ship`.");
  }

  let sha;
  if (shaArg) {
    sha = git("rev-parse", shaArg);
    git("fetch", "origin", "main");
    if (!run("git", ["merge-base", "--is-ancestor", sha, "origin/main"], { allowFail: true }).ok) {
      throw new Error(`${sha.slice(0, 7)} no está en origin/main: Vercel no puede construirlo.`);
    }
  } else {
    log("check:deploy…");
    const chk = run("npm", ["run", "--silent", "check:deploy"], { allowFail: true });
    process.stdout.write(chk.out);
    if (!chk.ok) throw new Error("check:deploy encontró errores: no publico.");

    git("fetch", "origin", "main");
    const atras = Number(git("rev-list", "--count", "HEAD..origin/main"));
    if (atras > 0) {
      throw new Error(
        `origin/main tiene ${atras} commit(s) que no están aquí. Corre \`git pull --rebase\` y vuelve a \`npm run ship\`.`,
      );
    }
    const adelante = Number(git("rev-list", "--count", "origin/main..HEAD"));
    if (adelante === 0) {
      log("nada que pushear: verifico el deploy de origin/main");
    } else if (DRY) {
      log(`(dry-run) pushearía ${adelante} commit(s) a origin/main`);
    } else {
      await push();
    }
    sha = git("rev-parse", "HEAD");
  }

  const corto = sha.slice(0, 7);
  log(`esperando que Vercel registre el deploy de ${corto}…`);
  let d = await esperarRegistro(sha);
  if (!d) {
    log(`Vercel no registró ${corto} en ${ESPERA_REGISTRO_MS / 60_000} min (el aviso de GitHub no llegó). Lo creo directo en Vercel.`);
    for (const i of await incidentes()) log(`  incidente abierto → ${i}`);
    try {
      d = await forzarDeploy(sha);
    } catch (e) {
      throw new Error(
        `${e.message}\nCréalo a mano: Vercel → data-glovox → Deployments → Create Deployment → main.`,
      );
    }
    if (!d) return; // dry-run
  } else if (estado(d) === "ERROR") {
    throw new Error(`El build de ${corto} falló en Vercel: https://${d.url}\nLog: vercel inspect https://${d.url} --logs`);
  }

  log(`deploy https://${d.url}; esperando que termine…`);
  d = await esperarBuild(sha);
  if (estado(d) !== "READY") {
    throw new Error(`El deploy terminó en ${estado(d)}: https://${d.url}\nLog: vercel inspect https://${d.url} --logs`);
  }
  // Lo que importa es qué sirve producción, no solo que el build terminó: con
  // avisos atrasados, un deploy de un commit anterior puede quedar encima.
  const prod = api(`/v9/projects/${projectId}`).targets?.production;
  const prodSha = prod?.meta?.githubCommitSha;
  if (prodSha && prodSha !== sha) {
    git("fetch", "origin", "main");
    if (!run("git", ["merge-base", "--is-ancestor", sha, prodSha], { allowFail: true }).ok) {
      throw new Error(
        `El build de ${corto} terminó, pero producción sirve ${prodSha.slice(0, 7)} (https://${prod.url}), que no lo incluye. Vuelve a correr \`npm run ship\`.`,
      );
    }
  }
  const dominio = (prod?.alias ?? d.alias ?? []).find((a) => !a.endsWith(".vercel.app"));
  log(`✓ producción con ${corto}: https://${prod?.url ?? d.url}${dominio ? ` (${dominio})` : ""}`);
}

main().catch((e) => {
  console.error(`[ship] ✗ ${e.message}`);
  process.exit(1);
});
