const getText = require("./googleVisionAPI");
const { exec, execSync } = require("child_process");
const { readFile, unlink } = require("fs").promises;
const Jimp = require("jimp");

//  API KEY file path
let API_KEY_PATH = undefined;

// Emr configs
let emrConfigs = [];

// Jimp object representing last screenshot taken
let lastScreenshot = null;

// Osascript to detect title of active window in case the active win fails
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

const set_api_key = (path) => (API_KEY_PATH = path);

const set_config = (emrconfig) => (emrConfigs = emrconfig.config);

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

    let { title } = window;
    const { bounds, id } = window;

    // In case active win fails to detect title
    if (title === "" && process.platform === "darwin") {
      try {
        const output = execSync(`osascript -e '${osascript}'`);
        title = output.toString();
      } catch {}
    }

    if (emrConfigs.length === 0) {
      return {
        windowId: id,
        windowTitle: title,
        windowBounds: bounds,
      };
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
 * Crops screenshot according to crop percentages
 * @param {Object} img Jimp image object
 * @param {Object} cropPercentages Crop percentages
 * @return {Object} Jimp image object
 */
const cropScreenshot = (img, cropPercentages) => {
  // Finding bounding box
  const { width, height } = img.bitmap;
  const { left, top, right, bottom } = cropPercentages;
  const x = Math.floor((left * width) / 100);
  const y = Math.floor((top * height) / 100);
  const w = Math.ceil((right * width) / 100 - x);
  const h = Math.ceil((bottom * height) / 100 - y);

  return img.crop(x, y, w, h);
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
  const screenshotDesktop = require("screenshot-desktop");
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
      return img.replace("data:image/png;base64,", "");
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
      const { readFile, unlink } = require("fs").promises;

      readFile(tempPath)
        .then((file) => {
          img = Buffer.from(file).toString("base64");
          // Delete saved screenshot
          return unlink(tempPath);
        })
        .then(() => resolve(img))
        .catch((err) => reject(err));
    });
  });
};

const grabScreenshotLinux = (windowId) => {
  return new Promise((resolve, reject) => {
    let screenshot = null;

    const tempPath = `${new Date().valueOf()}.jpg`;

    exec(`import -window ${windowId} ${tempPath}`, (error) => {
      if (error) {
        reject(error);
      }

      readFile(tempPath)
        .then((img) => {
          screenshot = img;
          // Delete saved screenshot
          return unlink(tempPath);
        })
        // Create Jimp object
        .then(() => Jimp.read(screenshot))
        // Scale down screenshot
        .then((img) => img.scale(0.5))

        .then((img) => resolve(img))
        .catch((err) => reject(err));
    });
  });
};

const getImage = (windowId, windowBounds) => {
  try {
    if (process.platform === "win32")
      return grabScreenshotWindows(windowBounds);
    else if (process.platform === "linux") return grabScreenshotLinux(windowId);
    return grabScreenshotMac(windowId);
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Finds whether the current screenshot is different from the last screenshot
 * @param {Object} screenshot Jimp image object
 * @return {boolean} Whether the screenshot is different
 */
const isScreenshotDifferent = (screenshot) => {
  if (!screenshot || !lastScreenshot) return true;
  return Boolean(Jimp.diff(screenshot, lastScreenshot, 0).percent);
};

const extractText = async () => {
  // check if API KEY is set or not
  if (API_KEY_PATH === undefined) {
    return new Error("Api key path not found");
  }

  const window = detectWindow();

  if (window) {
    try {
      let image = await getImage(window.windowId, window.windowBounds);

      // image can't be taken
      if (!image) {
        return new Error("Screenshot can't be taken");
      }

      if (window.cropPercentages) {
        // Crop the screenshot
        const croppedScreenshot = cropScreenshot(
          image.clone(), // Sending clone of origional screenshot as we need origional screenshot
          window.cropPercentages
        );

        // Compare cropped screenshot with last croppped screenshot
        if (!isScreenshotDifferent(croppedScreenshot)) {
          // Screenshot were same
          return new Error("Screenshot same as previous screenshot");
        }

        // Save cropped screenshot as lastScreenshot for comparision in next iteration
        lastScreenshot = croppedScreenshot;
      }
      // Return origional screenshot in the form of base64 string
      image = await image.getBase64Async("image/png");

      // .then((img) => img = Buffer.from(file).toString("base64"))

      image = image.replace("data:image/png;base64,", "");

      let texts = await getText(API_KEY_PATH, image);

      if (!texts) {
        return new Error();
      }

      return texts;
    } catch (e) {
      return e;
    }
  }
};

module.exports = { set_api_key, set_config, extractText };
