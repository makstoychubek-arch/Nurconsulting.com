'use strict';

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function stamp() {
  return new Date().toISOString();
}

function append(file, line) {
  ensureLogsDir();
  fs.appendFileSync(path.join(LOGS_DIR, file), `${stamp()} ${line}\n`, 'utf8');
}

function info(message) {
  const line = `[INFO] ${message}`;
  console.log(line);
  append('bot.log', line);
}

function error(message, err) {
  const detail = err ? `${message}: ${err.stack || err.message || err}` : message;
  const line = `[ERROR] ${detail}`;
  console.error(line);
  append('bot.log', line);
  append('errors.log', line);
}

module.exports = { info, error };
