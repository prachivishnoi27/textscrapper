const getText = require("./googleVisionAPI");
const { exec, execSync } = require("child_process");
const { readFile, unlink } = require("fs").promises;
const Jimp = require("jimp");
const screenshotDesktop = require("screenshot-desktop")

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


/**
 * Converts a rect buffer to a rect object
 * @param {Object} buffer Rect buffer
 * @returns {Object} Rect object
 */
 const rectBufferToObject = (buffer) => {
  const rect = {};
  rect.left = buffer.readInt32LE(0) < 0 ? 0 : buffer.readInt32LE(0);
  rect.top = buffer.readInt32LE(4) < 0 ? 0 : buffer.readInt32LE(4);
  rect.right = buffer.readInt32LE(8);
  rect.bottom = buffer.readInt32LE(12);
  return rect;
};


/**
 * Get active window on win32 platform
 * @returns {Object} Active window details
 */
 const getActiveWindowWin32 = () => {
   console.log("in detect window")
    const { U } = require("win32-api");
    const u32 = U.load([
      "GetForegroundWindow",
      "GetWindowTextW",
      "GetWindowRect",
    ]);
  
    const titleBuffer = Buffer.alloc(1000);
    const rectBuffer = Buffer.alloc(16);
  
    const windowHandle = u32.GetForegroundWindow();
    u32.GetWindowTextW(windowHandle, titleBuffer, 1000);
    u32.GetWindowRect(windowHandle, rectBuffer);
  
    const title = titleBuffer.toString("ucs-2").replace(/\0/g, "");
    const bounds = rectBufferToObject(rectBuffer);
    // console.log(title, bounds);
    return { title, bounds };
  };
  

/**
 * Detects active EMR window
 * @return {Object|null} Object containing active EMR window information.
 * Returns null if EMR not found or in case of error
 */
const detectWindow = () => {
  try {
    let window = {};
    // Get active window title and id
    if (process.platform === "win32") {
      window = getActiveWindowWin32();
    } else if (process.platform === "darwin" || process.platform === "linux") {
      window = require("active-win").sync();
    }
    console.log(window);
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
      title.includes(config.windowWildCard)
    );

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


/**
 * Take screenshot of the windows with given window bounds on windows os
 * @param {Object} bounds Window bounds
 * @return {Object} Screenshot in the form of Jimp image object
 */
 const grabScreenshotWindows = ({ left, top, right, bottom }) => {
    const x = left;
    const y = top;
    const width = right - top;
    const height = bottom - top;
    return screenshotDesktop()
      .then((img) => {
        return Jimp.read(img);
      })
      .then((img) => {
        return img.crop(x, y, width, height);
      })
      .then((img) => {
        return img.getBase64Async(Jimp.MIME_PNG);
      })
      .then((img) => {
        return img.replace("data:image/png;base64,", "")
      });
  };
  

const grabScreenshotMac = (windowId) => {
   
    return new Promise((resolve, reject) => {
      
        let img;
  
        const tempPath = `${new Date().valueOf()}.jpg`;
      
      exec(`screencapture -l ${windowId} -o -x -t jpg '${tempPath}'`, (error) => {
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

const grabScreenshotLinux = (windowId) => {

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
        return grabScreenshotWindows(windowBounds);
      else if(process.platform === "linux") 
        return grabScreenshotLinux(windowId);
      return grabScreenshotMac(windowId);
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
            .then(data => {
                texts = data;
            })
            .catch(() => console.log("Google Vision: Unable to get Text"));
        }).catch((err) => console.log(err))
    }
    return texts;
};

setTimeout(() => {
    let texts = extractText("../test/api_key.json", [
        {active: true,
        displayName: "ExtractText",
        cropPercentages: { top: 10, right: 70, left: 5, bottom: 50 },
        windowWildCard: "extractText",
        emrKey: "EXTRACT_TEXT",
    regex: true}
    ]);
    texts.forEach(text => console.log(text.description));
}, 5000);
