export const clone=value=>structuredClone(value);
export class History {
 constructor(){this.reset();}
 reset(){this.value=[];this.past=[];this.future=[];}
 commit(value){if(JSON.stringify(value)===JSON.stringify(this.value))return false;this.past.push(clone(this.value));this.value=clone(value);this.future=[];return true;}
 undo(){if(!this.past.length)return false;this.future.push(clone(this.value));this.value=this.past.pop();return true;}
 redo(){if(!this.future.length)return false;this.past.push(clone(this.value));this.value=this.future.pop();return true;}
}
export function moveRect(r,dx,dy,b){dx=Math.max(b[0]-r[0],Math.min(b[2]-r[2],dx));dy=Math.max(b[1]-r[1],Math.min(b[3]-r[3],dy));return [r[0]+dx,r[1]+dy,r[2]+dx,r[3]+dy];}
export function resizeRect(r,corner,p,b,min=5){let v=[...r];if(corner.includes('w'))v[0]=Math.max(b[0],Math.min(r[2]-min,p[0]));if(corner.includes('e'))v[2]=Math.min(b[2],Math.max(r[0]+min,p[0]));if(corner.includes('n'))v[1]=Math.max(b[1],Math.min(r[3]-min,p[1]));if(corner.includes('s'))v[3]=Math.min(b[3],Math.max(r[1]+min,p[1]));return v;}
