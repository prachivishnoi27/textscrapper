async function getText(API_KEY_PATH, imgPath) {
    // Imports the Google Cloud client library
    const vision = require('@google-cloud/vision');
  
    // Creates a client
    const client = new vision.ImageAnnotatorClient({
        // keyFilename: "../test/api_key.json"
        keyFilename: API_KEY_PATH
    });

    // console.log(client);
  
    // Performs label detection on the image file
    // console.log("Image Path: ", imgPath);
    const [result] = await client.textDetection({
        image: {
          content: Buffer.from(imgPath, 'base64')
        }
      });
    // console.log(typeof result);
    // console.log(result);
    const texts = result.textAnnotations;
    // console.log('Text:');
    // console.log(texts.length);
    // texts.forEach(text => console.log(text.description));
    return texts;
}

module.exports = getText;