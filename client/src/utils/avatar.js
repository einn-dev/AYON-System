/* Profile-picture helpers */

export const AVATAR_TYPES   = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_MB  = 2;
const OUTPUT_SIZE = 512;     // the saved picture is a 512 x 512 square

/* Returns an error message, or '' when the file is fine. */
export const checkAvatarFile = (file) => {
  if (!file) return 'No file selected.';
  if (!AVATAR_TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WEBP picture.';
  if (file.size > AVATAR_MAX_MB * 1024 * 1024) return `The picture must be ${AVATAR_MAX_MB}MB or smaller.`;
  return '';
};

/* Centre-crops the picture to a square and shrinks it, so every profile picture
   fits the round frame and loads fast. Resolves to a JPEG Blob. */
export const prepareAvatar = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth  - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const size = Math.min(OUTPUT_SIZE, side);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';                  // transparent PNGs get a white background
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the picture.'))),
          'image/jpeg', 0.9
        );
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
    img.src = url;
  });