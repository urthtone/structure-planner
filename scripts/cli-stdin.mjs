import { spawnSync } from 'node:child_process';
// Node spawnSync stdin is a Unix socket. A CLI opening /dev/stdin by filename
// cannot reopen it (ENXIO). Python's subprocess.PIPE supplies an actual pipe.
// Input stays in memory; never place it in argv, a file, or a log.
const bridge = `import subprocess,sys
result=subprocess.run(sys.argv[1:],input=sys.stdin.buffer.read(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
sys.stdout.buffer.write(result.stdout)
sys.stderr.buffer.write(result.stderr)
sys.exit(result.returncode)
`;
export function spawnWithReadableStdin(command,args,options) {
  return spawnSync('python3',['-c',bridge,command,...args],options);
}
