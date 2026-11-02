// Shared by file-picker and drop paths; validate before changing the document.
export function singlePDF(files){
 if(files.length!==1)throw Error('Choose one PDF at a time.');
 const file=files[0];
 if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'))throw Error('Choose a PDF file (.pdf).');
 if(!file.size)throw Error('This PDF is empty. Choose another file.');
 return file;
}
export function hasPDFHeader(bytes){
 const header=String.fromCharCode(...new Uint8Array(bytes).slice(0,1024));
 return header.includes('%PDF-');
}
export function isFileDrag(transfer){return Array.from(transfer?.types||[]).includes('Files');}
