#!/usr/bin/env node
// Validate the canonical example YAML files against their schemas using the
// same ajv configuration the shipped build-report bundle uses at audit time.
// One validator, one regex dialect: what passes here is exactly what passes
// `build-report.js validate` in the wild.
//
// Usage: node src/schemas/validate-examples.mjs [schemaDir]
// Exit 0 when every example validates, 1 on any error, 2 on bad usage.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileValidators, validateYamlFile, formatValidationErrors } from '../viewer/build-report.mjs';

const schemaDir = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
const { validateRecon, validateFindings } = compileValidators(schemaDir);

const errors = [
  ...validateYamlFile(join(schemaDir, 'recon.example.yaml'), 'recon.example.yaml', validateRecon),
  ...validateYamlFile(join(schemaDir, 'findings.example.yaml'), 'findings.example.yaml', validateFindings),
];

if (errors.length) {
  console.error(formatValidationErrors(errors));
  console.error(`\n${errors.length} validation error${errors.length === 1 ? '' : 's'} in ${schemaDir}`);
  process.exit(1);
}
console.log(`ok  ${join(schemaDir, 'recon.example.yaml')}`);
console.log(`ok  ${join(schemaDir, 'findings.example.yaml')}`);
