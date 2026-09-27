import {_roots,addAfterEffect} from '@react-three/fiber';
const node=document.createElement('pre');node.hidden=true;node.dataset.testid='foundation-report';document.body.append(node);let last=0;
addAfterEffect(()=>{const now=performance.now();if(now-last<1000)return;last=now;
 const root=[..._roots.values()][0];if(!root)return;const {scene,gl}=root.store.getState();
 const models=[];scene.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position?.count===30518)models.push(o);});
 const labels=[...document.querySelectorAll('[data-car-detail]')];
 node.textContent=JSON.stringify({view:document.querySelector('[data-testid="circuit-view-state"]')?.textContent,
 labels:labels.length,tiers:labels.reduce((a,e)=>{const k=e.dataset.carDetail;a[k]=(a[k]||0)+1;return a;},{}),models:models.length,
 sharedCarGeometries:new Set(models.map(m=>m.geometry)).size,calls:gl.info.render.calls,triangles:gl.info.render.triangles,
 geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,
 resources:performance.getEntriesByType('resource').filter(r=>/\.glb|\.png|\.jpg/.test(r.name)).map(r=>({url:r.name,body:r.encodedBodySize,transfer:r.transferSize}))});
});