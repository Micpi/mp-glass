import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
/**
 * The only supported way to publish MP Nexus: it refuses every shape of the mistake that shipped 0.11.2 to 0.11.8 with
 * the code of 0.11.1. `gh release create` tags the head of the REMOTE default branch, so an unpushed commit silently
 * republishes the previous release under a new number and HACS serves stale code. Here `main` is pushed first, the
 * remote head is read back, the tag is created on that exact sha, and what GitHub serves is verified afterwards.
 * Usage: `npm run release` (add `-- --dry-run` to run every check and stop before pushing).
 */
const dryRun = process.argv.includes('--dry-run');
const fail = message => { console.error(`\n✗ ${message}`); process.exit(1); };
const ok = message => console.log(`✓ ${message}`);
const run = (file, args, env) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], env }).trim();
const git = (...args) => run('git', args, process.env);
// The shell's GITHUB_TOKEN is invalid and shadows the keyring login, so gh never sees it from here.
const ghEnv = { ...process.env };
delete ghEnv.GITHUB_TOKEN; delete ghEnv.GH_TOKEN;
const gh = (...args) => run('gh', args, ghEnv);
// A probe: whether the call succeeds, its own "404 Not Found" kept off the console.
const ghWorks = (...args) => { try { execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: ghEnv }); return true; } catch { return false; } };
const quoted = value => value.replace(/\./g, '\\.');

// 1. One version, everywhere: a mismatch means HACS, the bundle cache key and the tag disagree.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('custom_components/mp_glass/manifest.json', 'utf8'));
const constants = await readFile('custom_components/mp_glass/const.py', 'utf8');
const version = pkg.version, tag = `v${version}`;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`package.json version "${version}" is not X.Y.Z`);
if (manifest.version !== version) fail(`manifest.json is ${manifest.version}, package.json is ${version}`);
const declared = constants.match(/^VERSION = "(.+)"$/m)?.[1];
if (declared !== version) fail(`const.py is ${declared}, package.json is ${version}`);
ok(`version ${version} agrees across package.json, manifest.json and const.py`);

// 2. The committed bundle is the one being released: `npm run build` must have run after the bump.
const bootstrap = await readFile('custom_components/mp_glass/www/mp-glass-bootstrap.js', 'utf8');
if (!bootstrap.includes(`mp-glass.js?v=${version}`)) fail(`www/ still carries an older build — run \`npm run build\` before releasing ${version}`);
ok('the committed www/ bundle carries this version');

// 3. The CHANGELOG entry is the release notes: no entry, no release.
const changelog = await readFile('CHANGELOG.md', 'utf8');
const entry = changelog.split(/^## /m).find(block => new RegExp(`^${quoted(version)}(\\s|$)`).test(block));
if (!entry) fail(`CHANGELOG.md has no "## ${version}" section`);
const [heading, ...body] = entry.split('\n');
const title = heading.replace(new RegExp(`^${quoted(version)}\\s*[—–-]?\\s*`), '').trim() || version;
const notes = body.join('\n').trim();
if (!notes) fail(`the "## ${version}" section of CHANGELOG.md is empty`);
ok(`release notes read from CHANGELOG.md — ${title}`);

// 4. Releasing anything but a clean main is how the wrong tree gets tagged.
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('releases are cut from main only');
if (git('status', '--porcelain')) fail('the working tree has uncommitted changes — commit them first');
const head = git('rev-parse', 'HEAD');
if (git('tag', '-l', tag)) fail(`${tag} already exists locally`);
if (ghWorks('api', `repos/{owner}/{repo}/git/ref/tags/${tag}`, '--silent')) fail(`${tag} already exists on GitHub`);
ok(`main is clean at ${head.slice(0, 7)} and ${tag} is free`);

if (dryRun) { console.log(`\n${tag} is ready to publish — rerun without --dry-run.`); process.exit(0); }

// 5. Push, then read the remote head back. A push that prints "Everything up-to-date" without pushing stops here.
execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
if (remote !== head) fail(`origin/main is at ${remote.slice(0, 7)}, this commit is ${head.slice(0, 7)} — the push did not land, nothing was tagged`);
ok(`origin/main is at ${head.slice(0, 7)}`);

// 6. Tag that exact sha, never "main" and never gh's own default.
gh('release', 'create', tag, '--target', head, '--title', `MP Nexus ${version} - ${title}`, '--notes', notes);
ok(`release ${tag} created`);

// 7. Verify what GitHub actually serves: the tag's commit, and the version inside the released const.py.
const tagged = JSON.parse(gh('api', `repos/{owner}/{repo}/git/ref/tags/${tag}`)).object.sha;
if (tagged !== head) fail(`${tag} points at ${tagged.slice(0, 7)} instead of ${head.slice(0, 7)} — delete it with \`gh release delete ${tag} --cleanup-tag --yes\` and retry`);
const served = Buffer.from(JSON.parse(gh('api', `repos/{owner}/{repo}/contents/custom_components/mp_glass/const.py?ref=${tag}`)).content, 'base64').toString();
if (!served.includes(`VERSION = "${version}"`)) fail(`the code served at ${tag} is not ${version} — HACS would install the wrong build`);
ok(`HACS will install ${version} from ${tag}`);
console.log(`\n${gh('release', 'view', tag, '--json', 'url', '--jq', '.url')}`);
