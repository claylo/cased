# Report Template

This defines the exact structure of the rendered audit report
(`index.md` within the audit directory). The agent should follow this
structure precisely. Sections marked `[generated]` are populated from
the intermediate YAML artifacts.

````markdown
---
audit_date: YYYY-MM-DD
project: {project name}
commit: {full SHA}
scope: {what was audited}
auditor: {agent or human identifier, including model name and effort level}
findings:
  critical: {n}
  significant: {n}
  moderate: {n}
  advisory: {n}
  note: {n}
---

# Audit: {Project Name}

{One paragraph — 3-5 sentences — stating what was audited, the overall
posture, and the single most important takeaway. This is not an "executive
summary" full of weasel words. It is a direct assessment. Example:}

{"`tokio-widget` implements a WebSocket relay with custom authentication.
The authentication layer assumes token integrity without cryptographic
verification, making session hijacking trivial for any network-adjacent
attacker. The dependency tree is current and the error handling is
disciplined. Fix the auth, and this is solid infrastructure."}

<!-- Terrain Map -->

<p align="center">
<img src="assets/terrain-map.svg" alt="Codebase terrain map showing
module structure and finding density" width="700" />
</p>

<sub>
Module sizes proportional to code volume. Edge weight shows coupling.
Stroke weight indicates finding density. Generated from
recon.yaml.
</sub>

---

## {Narrative Title}

{Narrative thesis — one sentence in italic.}

### {Finding Title} {#finding-slug}

**{concern level}** · `{file_path}:{start_line}-{end_line}` · effort: {effort} · <img src="assets/sparkline-{slug}.svg" height="14" alt="commit activity" />

{Mechanism paragraph — why this matters, in context, for this codebase.}

```{language} {file_path}:{start_line}-{end_line}
{evidence code}
```

{If chains exist:}
Enables [{linked finding title}](#{linked-slug}).
Enabled by [{linked finding title}](#{linked-slug}).

**Remediation:** {Concrete action. Code sketch if non-obvious:}

```{language}
{remediation code sketch}
```

<!-- whitespace is important -->
<div>&hairsp;</div>

### {Next Finding Title} {#next-slug}

{... same structure ...}

*Verdict: {1-3 sentence net assessment of this narrative.}*

<!-- whitespace is important -->
<div>&nbsp;</div>

## {Next Narrative Title}

{... repeat ...}

<!-- whitespace is important -->
<div>&nbsp;</div>

## Remediation Ledger

| Finding | Concern | Location | Effort | Chains |
|---------|---------|----------|--------|--------|
| [{slug}](#{slug}) | {level} | `{path}:{lines}` | {effort} | enables: [{slug}](#{slug}) |
| ... | ... | ... | ... | ... |

{Table is grouped by narrative. A blank row or narrative-name subheader
separates groups. Rows are ordered by narrative order, not severity.}


<sub>
Generated {YYYY-MM-DD} at commit {short SHA}.
Intermediate artifacts: recon.yaml, findings.yaml.
</sub>
````

## Rendering Rules

**Markdown flavor**: GitHub-Flavored Markdown (GFM). No HTML beyond `<img>`,
`<sub>`, `<sup>`, and `<p align="center">`. These are the tags GitHub
reliably renders in markdown files.

**Anchor generation**: Finding slugs become fragment anchors via the standard
GFM heading-to-id algorithm (lowercase, hyphens for spaces, strip special
chars). The `{#finding-slug}` syntax in the template is a reminder — in
practice, use the heading text itself as the anchor source.

**SVG inlining**: For terrain maps, use `<img src="...">` pointing to the
file in `assets/`. For sparklines, inline via `<img>` with a
`height="14"` attribute to keep them text-height. If the sparkline SVG is
under 500 bytes, it *may* be base64-inlined as a data URI, but file
references are preferred for readability.

**Line length**: Wrap prose at ~80 characters for readable diffs. Code blocks
are not wrapped.

**Front matter**: The YAML front matter block is not rendered by GitHub but
is machine-parseable. Downstream tools (kravitz hooks, CI scripts) can
read the findings summary without parsing the full document.
