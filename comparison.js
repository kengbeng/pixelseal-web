import {mupdf} from './core.js?v=0.6.0';
import {comparisonRegion} from './ui-model.js?v=0.6.0';
export function renderAreaComparison(source,output,mark){
 const page=source.loadPage(mark.page),redacted=output.loadPage(mark.page);
 try{
  const region=comparisonRegion(mark.rect,page.getBounds()),width=region[2]-region[0],height=region[3]-region[1];
  if(width<=0||height<=0)throw Error('Invalid comparison region.');
  const scale=Math.min(3,1200/width,600/height),size=[Math.ceil(width*scale),Math.ceil(height*scale)];
  function crop(p){const pix=new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,[0,0,...size],false);let device;try{pix.clear(255);device=new mupdf.DrawDevice([1,0,0,1,0,0],pix);p.run(device,[scale,0,0,scale,-region[0]*scale,-region[1]*scale]);device.close();return new Uint8Array(pix.asPNG());}finally{device?.destroy();pix.destroy();}}
  return {bounds:region,rect:mark.rect,width:size[0],height:size[1],original:crop(page),redacted:crop(redacted)};
 }finally{page.destroy();redacted.destroy();}
}
