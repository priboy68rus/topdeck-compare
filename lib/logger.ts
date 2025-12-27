type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const envLevel = (process.env.LOG_LEVEL as LogLevel | undefined) || "info";
const currentLevel = levelOrder[envLevel] ?? levelOrder.info;

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (levelOrder[level] < currentLevel) return;
  const payload = meta ? `${message} ${JSON.stringify(meta)}` : message;
  const tag = `[topdeck-compare:${level}]`;
  // eslint-disable-next-line no-console
  console.log(tag, payload);
}
