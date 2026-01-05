import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageService {
  private queue = signal<number>(0);

  async compress(file: File, maxWidth = 1200, quality = 0.75): Promise<File> {
    this.queue.update(n => n + 1);

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./image-compression.worker', import.meta.url));
      
      worker.onmessage = ({ data }) => {
        this.queue.update(n => n - 1);
        if (data.success) {
          resolve(new File([data.blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }));
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.postMessage({ file, maxWidth, quality });
    });
  }

  // Validateur intelligent
  isValid(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    return validTypes.includes(file.type) && file.size <= maxSize;
  }
}