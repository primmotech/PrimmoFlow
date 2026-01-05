/// <reference lib="webworker" />

addEventListener('message', async ({ data }) => {
  const { file, maxWidth, quality } = data;
  
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(
      Math.min(bitmap.width, maxWidth),
      (bitmap.height / bitmap.width) * Math.min(bitmap.width, maxWidth)
    );
    
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    // On privilégie WebP si supporté, sinon JPEG
    const blob = await canvas.convertToBlob({ 
      type: 'image/webp', 
      quality: quality 
    });

    postMessage({ blob, success: true });
// ... reste du code ...
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown compression error';
    postMessage({ error: errorMessage, success: false });
  }
// ...
});