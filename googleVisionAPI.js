async function getText(API_KEY_PATH, imgPath) {
    // Imports the Google Cloud client library
    const vision = require('@google-cloud/vision');
  
    // Creates a client
    const client = new vision.ImageAnnotatorClient({
        keyFilename: API_KEY_PATH
    });

  
    // Performs Text detection on the image file
    const [result] = await client.textDetection({
        image: {
          content: Buffer.from(imgPath, 'base64')
        }
      });
    const texts = result.textAnnotations;
    return texts;
}

module.exports = getText;