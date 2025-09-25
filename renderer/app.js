const worker = new Worker('worker.js');
worker.onmessage = (event) => {
  console.log('Received in main thread:', event.data);
};
worker.postMessage('Hello from main thread!');