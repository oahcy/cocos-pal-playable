import { compilePlugin } from './release/compile';
import { projectRoot } from './release/profile';
void compilePlugin(projectRoot).catch(error => { console.error(error); process.exitCode = 1; });
