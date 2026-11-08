import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const status = readFileSync('/proc/self/status', 'utf8');
const cap = status.match(/^CapEff:\s*(\w+)/m)[1];
const nnp = status.match(/^NoNewPrivs:\s*(\d+)/m)[1];
assert.equal(BigInt('0x' + cap), 0n);
assert.equal(nnp, '1');
assert.equal(existsSync('/home/martin'), false);
console.log(JSON.stringify({sandbox:{cap_eff:0,no_new_privs:1,real_home_visible:false}}));
function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 150000, maxBuffer: 8 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Child check failed');
  return result.stdout;
}
const tests = readdirSync('tests').filter(name => /\.test\.js$/.test(name)).sort();
assert.ok(tests.length >= 3, 'Expected engine, app and storage suites');
const tap = run(['--test', '--test-concurrency=1', '--test-reporter=tap', ...tests.map(name => 'tests/' + name)]);
const summary = key => Number(tap.match(new RegExp('^# '+key+' (\\d+)$', 'm'))?.[1]);
const count = summary('tests');
assert.ok(Number.isSafeInteger(count) && count > 0, 'No tests recorded');
for (const key of ['fail','cancelled','skipped','todo']) assert.equal(summary(key), 0, 'Unexpected ' + key);
assert.equal(summary('pass'), count);
console.log('TIMELINE_PUBLIC_TESTS=' + JSON.stringify({node_records:count,pass:count,fail:0,skipped:0,includes_parent_groups:true}));
if (existsSync('/acceptance')) {
  assert.equal(process.env.TIMELINE_ENGINE_URL, 'file:///work/src/engine.js');
  const raw = run(['/acceptance/engine-oracle.mjs', '/work/src/engine.js']);
  const result = JSON.parse(raw);
  assert.ok(Number.isSafeInteger(result.distinctMethods) && result.distinctMethods > 0);
  assert.equal(result.counts.PASS, result.distinctMethods); assert.equal(result.counts.FAIL, 0); assert.equal(result.counts.ERROR, 0);
  console.log('TIMELINE_PRIVATE_TESTS=' + JSON.stringify({methods:result.distinctMethods,pass:result.counts.PASS}));
}
run(['scripts/build.mjs', '--output', '/output/site']);
for (const name of ['LICENSE','THIRD_PARTY_NOTICES.md']) assert.deepEqual(readFileSync('/output/site/' + name), readFileSync(name));
const html = readFileSync('/output/site/index.html','utf8');
assert.ok(html.includes('seed1f359dd3'));
for (const name of ['src/main.js','src/styles.css','favicon.svg']) assert.ok(html.includes('./'+name) && existsSync('/output/site/'+name));
console.log('Static build, public tests and offline source isolation passed.');
