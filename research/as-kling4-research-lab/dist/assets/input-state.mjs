/** Input state shared by browser form/JSON transitions and asynchronous loading. */
export function createImageSelection(onChange){
 let version=0;
 function publish(uri,caption=''){
  const data=uri.startsWith('data:')?uri:null;
  onChange({uri,imageData:data,previewSrc:data,caption:data?caption:''});
 }
 return{
  set(uri,caption=''){version++;publish(uri,caption);},
  clear(){version++;publish('');},
  invalidate(){version++;},
  async load(decode){const ticket=++version;let result;try{result=await decode();}catch(e){if(ticket!==version)return false;throw e;}if(ticket!==version)return false;publish(result.uri,result.caption);return true;}
 };
}
