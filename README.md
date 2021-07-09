# textsrcapper

npm module for extracting text from any window active on your computer


### Peer Dependencies

- Google Cloud Vision API  
	```npm install @google-cloud/vision```

  
	For Mac and Linux:  
```npm install active-win```

	For Windows:  
	```npm install jimp screenshot-desktop```
	
	Linux users may need to install ImageMagicK on your system
  

## Install
```npm install textscrapper```

##  Quickstart
Before you begin
1.  [Select or create a Cloud Platform project](https://console.cloud.google.com/project).
2.  [Enable billing for your project](https://support.google.com/cloud/answer/6293499#enable-billing).
3.  [Enable the Google Cloud Vision API](https://console.cloud.google.com/flows/enableapi?apiid=vision.googleapis.com).
4.  [Set up authentication with a service account](https://cloud.google.com/docs/authentication/getting-started)  so you can access the API from your local workstation.

## Usage
```
async printText () => {
	let texts = await extractText(API_KEY_PATH, {
		config: [
		{
			active: true,
			displayName: "Google Chrome",
			windowWildCard: "Google",
			emrKey: "GOOGLE"
		},
		{
			active: true,
			displayName: "Visual Studio Code",
			windowWildCard: "Code"
			emrKey: "VSCODE"	
		}
	]});
	texts.forEach((text) => console.log(text.description));
}
```

- First argument i.e API_KEY_PATH is the path of json file downloaded after you have successfully set credentials for Google Cloud Vision API.
- Second argument is object containing config key, which thereafter contains  array of information of all the windows you want to extract text of. This argument is optional, if you did not pass anything it will allow all active windows.

## License
MIT

## Keywords

**screenshot** **extract text** **google cloud vision API**