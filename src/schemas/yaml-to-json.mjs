#!/usr/bin/env node
//
// Read YAML from stdin, emit JSON on stdout.
//
// Uses the same `yaml` npm package that ships with the cased skill, so
// the JSON representation produced here matches what build-report.js
// sees at audit time. Using `yj` would introduce a YAML 1.1 vs 1.2
// semantic mismatch (bare dates in particular) and force every example
// file to quote values unnecessarily.

import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const input = readFileSync(0, 'utf8');
const data = YAML.parse(input);
process.stdout.write(JSON.stringify(data));
