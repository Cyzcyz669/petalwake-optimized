import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'petalwake-strip-'));
let code=fs.readFileSync(path.join(root,'src/fx/strip.js'),'utf8');
code=code.replace("from 'three'",`from '${pathToFileURL(path.join(root,'vendor/three/build/three.module.js')).href}'`);
code=code.replace("import { U, World } from '../core/ctx.js';", "const U = {uNoiseTex:{},uStripTex:{}}; const World = {size:6144,half:3072};");
code=code.replace("import { RIBBON_VERT, VORTEX } from './vortex.js';", "const RIBBON_VERT = ''; const VORTEX = {N:5};");
const tmp=path.join(dir,'strip.mjs');fs.writeFileSync(tmp,code);
try {
 const {Strip}=await import(pathToFileURL(tmp).href);
 const samples=[]; const r={autoClear:true,setRenderTarget(){},setClearColor(){},clear(){},render(){samples.push(strip.rt.texture.mipmapsAutoUpdate)}};
 const v={ribbon:{drawRange:{count:3},morphAttributes:{}},count:0};
 const strip=new Strip(r,v); for(let i=0;i<120;i++) strip.update(1/60);
 assert.equal(samples.length,120);assert.equal(samples[0],true);
 const generated=samples.filter(Boolean).length; assert(generated>=7&&generated<=10,`unexpected mip rebuild count: ${generated}`);
 assert.equal(strip.rt.width,4096); assert.equal(strip.rt.height,4096); assert.equal(strip.rt.texture.generateMipmaps,true);
 console.log(`PASS: 120 full-resolution stamps; ${generated} mipmap updates; original texture size retained`);
} finally {fs.rmSync(dir,{recursive:true,force:true})}
