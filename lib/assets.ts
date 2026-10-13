export const MAX_ASSET_BYTES=10*1024*1024;
export function assetMime(bytes:Uint8Array,kind:'image'|'pdf') {
 if(kind==='pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':null;
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
