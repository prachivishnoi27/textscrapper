const getText = require("./googleVisionAPI");
const { exec, execSync } = require("child_process");
const { readFile, unlink } = require("fs").promises;

let API_KEY_PATH = "";

let emrConfigs = [];

const osascript = `
global frontApp, frontAppName, windowTitle

set windowTitle to ""
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set frontAppName to name of frontApp
    tell process frontAppName
        tell (1st window whose value of attribute "AXMain" is true)
            set windowTitle to value of attribute "AXTitle"
        end tell
    end tell
end tell

return {windowTitle}
`;

const detectWindow = () => {
  try {
    let window = {};
    // Get active window title and id
    if (process.platform === "win32") {
      window = getActiveWindowWin32();
    } else if (process.platform === "darwin" || process.platform === "linux") {
      window = require("active-win").sync();
    }
    // console.log(window);
    let { title } = window;
    const { bounds, id } = window;

    // In case active win fails to detect title
    if (title === "" && process.platform === "darwin") {
      try {
        const output = execSync(`osascript -e '${osascript}'`);
        title = output.toString();
      } catch {}
    }

    // Check if title matches any emr
    const index = emrConfigs.findIndex((config) =>
      title.includes(config.displayName)
    );

    // console.log(index);

    // If title matches then return window info
    if (index > -1) {
      const config = emrConfigs[index];
      return {
        windowId: id,
        windowTitle: title,
        windowBounds: bounds,
        emrKey: config.emrKey,
        cropPercentages: config.cropPercentages,
      };
    }
    // //   Return null otherwise
    return null;
  } catch (error) {
    return null;
  }
};

const grabScreenshotTextLinux = (windowId) => {

    return new Promise((resolve, reject) => {
        let img;
  
      const tempPath = `${new Date().valueOf()}.jpg`;
  
      exec(`import -window ${windowId} ${tempPath}`, (error) => {
        if (error) {
          reject(error);
        }

        readFile(tempPath)
        .then((file) => {
          img = Buffer.from(file).toString('base64');
          // Delete saved screenshot
          return unlink(tempPath);
        })
        .then(() => resolve(img))
        .catch((err) => reject(err));
      });
    });
  }


const getImage = (windowId, windowBounds) => {
    try {
      if (process.platform === "win32")
        return grabScreenshotTextWindows(windowBounds);
      else if(process.platform === "linux") 
        return grabScreenshotTextLinux(windowId);
      return grabScreenshotTextMac(windowId);
    } catch (err) {
      return Promise.reject(err);
    }
};

const extractText = (KEY_PATH, emrConfig = []) => {
    API_KEY_PATH = KEY_PATH;
    emrConfigs = emrConfig;

    let texts = [];
    const window = detectWindow();

    if(window) {
        getImage(window.windowId, window.windowBounds).then((img) => {
            getText(API_KEY_PATH, img)
            .then(texts => {
                texts.forEach(text => console.log(text.description));
            })
            .catch(() => console.log("Google Vision: Unable to get Text"));
        }).catch((err) => console.log(err))

        if(texts.length !== 0) {
            texts.forEach(text => console.log(text.description));
        }
    }
    return texts;
};

extractText("../test/api_key.json", [
    {active: true,
    displayName: "Visual Studio Code",
    cropPercentages: { top: 10, right: 70, left: 5, bottom: 50 },
    windowWildCard: "extractText.*",
    emrKey: "VISUAL_STUDIO_CODE",
regex: true}
]);




// return texts;