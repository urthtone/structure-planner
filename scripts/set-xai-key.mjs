// Run only with the owner's approval. Secret is taken from process env, sent on
// stdin to Azure CLI, never placed in argv, written to disk, or printed.
import { spawnWithReadableStdin } from './cli-stdin.mjs';
import { writeFileSync } from 'node:fs';
const key=process.env.XAI_API_KEY;
if(!key) {
  const result={keySet:false,reason:'XAI_API_KEY absent from process environment'};
  writeFileSync('.azure/key-status.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} else {
  const result=spawnWithReadableStdin('az',['functionapp','config','appsettings','set',
    '--subscription','fab73657-6b07-46a5-956f-685cf81cb414',
    '--resource-group','rg-hilltop-planner-api','--name','hilltop-planner-api-da467d',
    '--settings','@/dev/stdin','--output','none'],{
      input:JSON.stringify({XAI_API_KEY:key}),encoding:'utf8',stdio:['pipe','pipe','pipe'],
    });
  if(result.status!==0) {
    // Never relay raw CLI streams: a failure could echo a settings payload.
    if(/az login|AADSTS|refresh token/i.test(result.stderr || ''))
      console.error('Fresh Azure login required: az login --tenant 2f633864-c751-46d0-a16b-2e48748dbcac --use-device-code');
    else {
      const markers=['stdin','seek','JSON','json','No such file','Permission','AuthorizationFailed','Forbidden','ResourceNotFound','InvalidRequestContent','InvalidParameter','BadRequest','TypeError','AttributeError','not found','not supported','required','parse','decode','invalid','ERROR'];
      const matched=markers.filter(marker=>(result.stderr || '').includes(marker));
      console.error(`Azure app-setting update failed (exit ${result.status ?? 'unknown'}); safe error markers: ${matched.join(', ') || 'unclassified'}. Raw streams/key withheld.`);
    }
    process.exit(1);
  }
  writeFileSync('.azure/key-status.json',JSON.stringify({keySet:true},null,2)+'\n');
  console.log('XAI_API_KEY set successfully; value not printed or stored locally.');
}
