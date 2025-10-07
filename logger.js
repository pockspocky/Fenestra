export const logLevels = ["debug", "log", "warn", "error", "none"];

const shouldLog = (level) => {
  return logLevels.indexOf(level) >= logLevels.indexOf(global.logLevel);
};

global.logLevel = "error"; // 默认级别，可在各文件中覆盖

const _console = console;
global.console = {
  ...global.console,
  log: (message, ...optionalParams) => {
    shouldLog("log") && _console.log(message, ...optionalParams);
  },
  warn: (message, ...optionalParams) => {
    shouldLog("warn") && _console.warn(message, ...optionalParams);
  },
  error: (message, ...optionalParams) => {
    shouldLog("error") && _console.error(message, ...optionalParams);
  },
  debug: (message, ...optionalParams) => {
    shouldLog("debug") && _console.debug(message, ...optionalParams);
  },
};
