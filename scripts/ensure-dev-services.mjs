import { spawn } from "node:child_process";
import net from "node:net";

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

export function runCompose(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", ...args], {
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`docker compose ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

export async function ensureDevServices({
  host = "127.0.0.1",
  postgresPort = parsePort(process.env.POSTGRES_PORT, 5433),
  redisPort = parsePort(process.env.REDIS_PORT, 6380),
  checkPort: check = (port) => checkPort(host, port),
  runCompose: compose = runCompose,
  log = console.info
} = {}) {
  const [postgresReady, redisReady] = await Promise.all([check(postgresPort), check(redisPort)]);

  if (postgresReady && redisReady) {
    log(
      `Reusing existing development services on ${host}:${postgresPort} (Postgres) and ${host}:${redisPort} (Redis).`
    );
    return {
      mode: "reuse",
      postgresPort,
      redisPort
    };
  }

  await compose(["up", "-d", "postgres", "redis"]);

  return {
    mode: "compose",
    postgresPort,
    redisPort
  };
}

const isDirectExecution = import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  ensureDevServices().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
