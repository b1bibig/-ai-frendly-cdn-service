const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
let ts;

try {
  // Prefer a local installation if available.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ts = require("typescript");
} catch {
  const globalModules = childProcess.execSync("npm root -g").toString().trim();
  ts = require(path.join(globalModules, "typescript"));
}

const AUTH_MODULE_PATH = path.join(process.cwd(), "lib", "auth.ts");

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    process.env[key] = value;
  }
}

function loadAuthModule() {
  const source = fs.readFileSync(AUTH_MODULE_PATH, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  });

  const moduleExports = {};
  const mod = { exports: moduleExports };

  const customRequire = (id) => {
    if (id === "@/app/lib/db") {
      return { sql: async () => ({ rows: [] }) };
    }

    if (id === "bcryptjs") {
      return { compare: async () => true, default: { compare: async () => true } };
    }

    if (id === "next-auth/providers/credentials") {
      return (config) => config;
    }

    if (id === "next-auth") {
      return {};
    }

    return require(id);
  };

  const wrapper = new Function("require", "module", "exports", transpiled.outputText);
  wrapper(customRequire, mod, moduleExports);
  return mod.exports;
}

function expectProductionFailureWithoutSecret() {
  const envSnapshot = { ...process.env };
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.AUTH_SECRET;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => loadAuthModule(), /must be set in production/);
  } finally {
    restoreEnv(envSnapshot);
  }
}

function expectSuccessWithSecret() {
  const envSnapshot = { ...process.env };
  process.env.NODE_ENV = "production";
  process.env.NEXTAUTH_SECRET = "test-secret";

  try {
    const auth = loadAuthModule();
    assert.strictEqual(auth.authOptions.secret, "test-secret");
  } finally {
    restoreEnv(envSnapshot);
  }
}

function expectDevAllowsMissingSecret() {
  const envSnapshot = { ...process.env };
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.AUTH_SECRET;
  process.env.NODE_ENV = "development";

  try {
    const auth = loadAuthModule();
    assert.strictEqual(auth.authOptions.secret, undefined);
  } finally {
    restoreEnv(envSnapshot);
  }
}

expectProductionFailureWithoutSecret();
expectSuccessWithSecret();
expectDevAllowsMissingSecret();

console.log("Auth secret configuration checks passed.");
