self.onmessage = (event) => {
    console.log('Received in worker:', event.data);
    self.postMessage('Hello from worker!');
};