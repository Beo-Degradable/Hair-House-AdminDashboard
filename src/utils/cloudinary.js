// Lightweight Cloudinary unsigned upload helper
// Requires env vars: REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET
export default async function uploadToCloudinary(file, { cloudName, uploadPreset } = {}) {
  // file: File | Blob
  // options: can pass { cloudName, uploadPreset } to override env or defaults
  if (!file) return null;
  const envCloud = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const envPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
  // sensible defaults: allow explicit options, then env vars, then a project default
  const cloud = cloudName || envCloud || 'dlgq64gr6';
  const preset = uploadPreset || envPreset || 'default';
  if (!cloud || !preset) throw new Error('Cloudinary cloud name or upload preset not configured');
  const url = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', preset);
  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Cloudinary upload failed: ' + text);
  }
  const data = await res.json();
  // return full Cloudinary response so callers can persist public_id, secure_url, etc.
  return data;
}
