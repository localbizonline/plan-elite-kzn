#!/usr/bin/env node
// ============================================================================
// runner-utils.mjs
// ============================================================================
// Shared utilities for the build runner: CLI parsing, script execution, retries.
// ============================================================================

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Parse CLI arguments into a flags object.
 * Supports: --key value, --flag (boolean true)
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

/**
 * Run a Node.js script as a child process with inherited stdio.
 * @param {string} scriptPath - Absolute path to the script
 * @param {string[]} args - CLI arguments as flat array: ['--project', '/path', '--data', 'file.json']
 * @param {object} options - { cwd, timeout, env }
 * @returns {string} stdout output
 */
export function runScript(scriptPath, args = [], options = {}) {
  const { cwd, timeout = 120_000, env } = options;

  if (!existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  const cmd = ['node', JSON.stringify(scriptPath), ...args.map(a => JSON.stringify(a))].join(' ');

  return execSync(cmd, {
    cwd,
    encoding: 'utf-8',
    timeout,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

/**
 * Run a shell command with inherited stdio.
 */
export function runCommand(cmd, options = {}) {
  const { cwd, timeout = 120_000, env, captureOutput = false } = options;

  return execSync(cmd, {
    cwd,
    encoding: 'utf-8',
    timeout,
    stdio: captureOutput ? 'pipe' : 'inherit',
    env: { ...process.env, ...env },
  });
}

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Max attempts (default 3)
 * @param {string} label - Label for log messages
 * @returns {Promise<*>} Result of fn
 */
export async function retry(fn, maxRetries = 3, label = 'operation') {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.log(`  ${label} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${(delay / 1000).toFixed(1)}s: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Slugify a string for use as a directory/site name.
 */
export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Validate that required environment variables are set.
 * @param {string[]} required - List of env var names
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnvVars(required) {
  const missing = required.filter(k => !process.env[k]);
  return { valid: missing.length === 0, missing };
}

/**
 * Print a phase banner to the console.
 */
export function printPhase(id, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${id}: ${label}`);
  console.log(`${'='.repeat(60)}\n`);
}
