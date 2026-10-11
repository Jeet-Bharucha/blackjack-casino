'use strict';
// Avatar uploads are stored directly in the user's profile. Only accept small
// image data URLs from safe raster formats. SVG/HTML cannot be uploaded.
const MAX_AVATAR_BYTES = 150 * 1024;
const MAX_AVATAR_BASE64_LENGTH = Math.ceil(MAX_AVATAR_BYTES / 3) * 4;
function validateAvatar(value) {
  if(value === null || value === '') return null; // Remove avatar.
  if(typeof value !== 'string' || value.length > MAX_AVATAR_BASE64_LENGTH + 48)
    throw new Error('Avatar must be a small JPEG, PNG, GIF or WebP image (150 KB maximum).');
  const match = /^data:image\/(jpeg|png|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if(!match) throw new Error('Avatar must be a JPEG, PNG, GIF or WebP image.');
  const bytes = Buffer.from(match[2],'base64');
  // Reject bad base64, decoded blobs larger than cap, and forged MIME types.
  if(!bytes.length || bytes.length > MAX_AVATAR_BYTES ||
      bytes.toString('base64') !== match[2])
    throw new Error('Avatar must be a valid image under 150 KB.');
  const kind=match[1].toLowerCase();
  let valid=false;
  if(kind==='png')valid=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  else if(kind==='jpeg')valid=bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  else if(kind==='gif')valid=bytes.subarray(0,6).toString('ascii')==='GIF87a' ||
    bytes.subarray(0,6).toString('ascii')==='GIF89a';
  else if(kind==='webp')valid=bytes.length>=12&&
    bytes.subarray(0,4).toString('ascii')==='RIFF'&&
    bytes.subarray(8,12).toString('ascii')==='WEBP';
  if(!valid)throw new Error('Avatar image data does not match its format.');
  return value;
}
module.exports={validateAvatar,MAX_AVATAR_BYTES};
