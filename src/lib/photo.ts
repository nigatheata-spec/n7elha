// Phone photos are several MB each; the AI reads a page just as well at
// 1600px, and the request stays small enough to send several pages at once.
export const shrinkPhoto = async (file: Blob): Promise<string> => {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
};

export const MAX_PHOTOS = 8;
