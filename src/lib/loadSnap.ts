export function loadSnap(clientKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // If already loaded
    if ((window as any).snap) {
      return resolve((window as any).snap);
    }
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.dataset.clientKey = clientKey;
    script.onload = () => resolve((window as any).snap);
    script.onerror = () => reject(new Error('Failed to load Midtrans Snap JS'));
    document.head.appendChild(script);
  });
}

