# textscrapper
<p><a href="https://github.com/prachivishnoi27/textscrapper/blob/main/LICENSE"><img alt="GitHub license" src="https://img.shields.io/github/license/prachivishnoi27/textscrapper"></a>  <a href="https://github.com/prachivishnoi27/textscrapper/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/prachivishnoi27/textscrapper"></a></p>

npm module for extracting text from any window active on your computer


### Peer Dependencies
- Axios, jimp
    
    
    ```npm install axios jimp```

For Mac and Linux:  
 - active-win

    ```npm install active-win```

For Windows:  
- screenshot-desktop
- win32-api  
    
	```npm install screenshot-desktop win32-api```
	
Linux users may need to install ImageMagicK:  
    ```sudo apt install imagemagick```
  
## Install
```npm install textscrapper```

##  Quickstart
Before you begin
1.  [Select or create a Cloud Platform project](https://console.cloud.google.com/project).
2.  [Enable billing for your project](https://support.google.com/cloud/answer/6293499#enable-billing).
3.  [Enable the Google Cloud Vision API](https://console.cloud.google.com/flows/enableapi?apiid=vision.googleapis.com).
4.  [Set up authentication with a service account](https://cloud.google.com/docs/authentication/getting-started)  so you can access the API from your local workstation.

## Usage
```js
const textscrapper = require("textscrapper");

(async () => {
    // api key of google cloud project
    textscrapper.setApiKey(API_KEY);

    // optional, sets emrconfigs to identify which window to detect or not
    // if not set, then it will detect all active windows
    textscrapper.setConfig({
        config: [
        {
            active: true,
            displayName: "Google Chrome",
            windowWildCard: "Google",
            emrKey: "GOOGLE",
            cropPercentages: { top: 20, right: 10, left: 10, bottom: 0 }
        },
        {
            active: true,
            displayName: "Visual Studio Code",
            windowWildCard: "Code",
            emrKey: "VSCODE",
            cropPercentages: { top: 10, right: 70, left: 5, bottom: 50 }
        }
    ]});

    // limit maximum results
    const maxResults = 5;
    try {
        // extract text from active windows
        let texts = await textscrapper.extractText(maxResults);
        console.log(texts);
    } catch (e) {
        console.error(e);
    } 
})();

// Other Methods

// Detect active window on your computer, returns window object.
const window = textscrapper.detectWindow();

// Get base64image of active window
const base64image = await textscrapper.getBase64Image(window);

// getText from base64image, {maxResults}: limit maximum results
const texts = await textscrapper.extractTextFromImage(base64Image, maxResults);
``` 

## License
MIT
