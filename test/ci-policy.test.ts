import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function missingRunThroughChecks(workflow: string): string[] {
  return ['typecheck', 'tests', 'build', 'audit'].filter(id => {
    const block = workflow.split(`      - id: ${id}\n`)[1]?.split('      - ')[0] ?? '';
    return !block.includes("if: ${{ !cancelled() && steps.install.outcome == 'success' }}");
  });
}

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('CI runs every independent check after earlier verification failures', () => {
  assert.deepEqual(missingRunThroughChecks(workflow), []);
});

test('CI policy rejects losing the run-through condition on each verification step', () => {
  for (const id of ['typecheck', 'tests', 'build', 'audit']) {
    const broken = workflow.replace(
      `- id: ${id}\n        if: \${{ !cancelled() && steps.install.outcome == 'success' }}\n`,
      `- id: ${id}\n`,
    );
    assert.deepEqual(missingRunThroughChecks(broken), [id]);
  }
});
