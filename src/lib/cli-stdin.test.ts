import { expect,it } from 'vitest';
import { spawnWithReadableStdin } from '../../scripts/cli-stdin.mjs';
it('provides a reopenable stdin pipe for JSON-file CLI arguments without disk files',()=>{
  const result=spawnWithReadableStdin(process.execPath,['-e',"const fs=require('node:fs'); const data=JSON.parse(fs.readFileSync('/dev/stdin','utf8')); console.log(data.fixture);"],{input:JSON.stringify({fixture:'non-secret-test-value'}),encoding:'utf8'});
  expect(result.status).toBe(0);expect(result.stdout.trim()).toBe('non-secret-test-value');
});
it('preserves exit status and captures CLI error streams instead of printing them',()=>{
  const result=spawnWithReadableStdin(process.execPath,['-e',"process.stderr.write('safe diagnostic');process.exit(23)"],{input:'{}',encoding:'utf8'});
  expect(result.status).toBe(23);expect(result.stderr).toBe('safe diagnostic');expect(result.stdout).toBe('');
});
